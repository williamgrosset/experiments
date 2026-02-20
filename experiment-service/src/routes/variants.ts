import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { createVariantSchema, updateVariantSchema } from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";
import { configPublisher } from "../services/config-publisher.js";
import { setPublishMetadataHeaders } from "../lib/http/publish-metadata.js";

export async function variantRoutes(app: FastifyInstance) {
  app.post<{
    Params: { experimentId: string };
  }>("/experiments/:experimentId/variants", async (request, reply) => {
    const { experimentId } = request.params;
    const parsed = createVariantSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0].message });
    }

    const { key, name, payload } = parsed.data;

    const metadata = {
      attempted: false,
      succeeded: false,
      error: undefined as string | undefined,
    };

    try {
      const variant = await experimentService.addVariant(experimentId, {
        key,
        name,
        payload: payload as unknown as Prisma.InputJsonValue,
      });

      const experiment = await experimentService.getById(experimentId);
      if (experiment?.status === "RUNNING") {
        metadata.attempted = true;
        try {
          await configPublisher.publish(experiment.environmentId);
          metadata.succeeded = true;
        } catch (err: unknown) {
          metadata.error = err instanceof Error ? err.message : "Unknown error";
        }
      }

      setPublishMetadataHeaders(reply, metadata);
      return reply.status(201).send(variant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Unique constraint")) {
        return reply.status(409).send({
          error: `Variant with key "${key}" already exists for this experiment`,
        });
      }
      if (message.includes("Foreign key constraint")) {
        return reply.status(404).send({ error: "Experiment not found" });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { experimentId: string; variantId: string };
  }>("/experiments/:experimentId/variants/:variantId", async (request, reply) => {
    const { experimentId, variantId } = request.params;
    const parsed = updateVariantSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const metadata = {
      attempted: false,
      succeeded: false,
      error: undefined as string | undefined,
    };

    try {
      const variant = await experimentService.updateVariant(variantId, {
        ...parsed.data,
        payload: parsed.data.payload as Prisma.InputJsonValue | null | undefined,
      });

      const experiment = await experimentService.getById(experimentId);
      if (experiment?.status === "RUNNING") {
        metadata.attempted = true;
        try {
          await configPublisher.publish(experiment.environmentId);
          metadata.succeeded = true;
        } catch (err: unknown) {
          metadata.error = err instanceof Error ? err.message : "Unknown error";
        }
      }

      setPublishMetadataHeaders(reply, metadata);
      return reply.send(variant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Record to update not found")) {
        return reply.status(404).send({ error: "Variant not found" });
      }
      throw err;
    }
  });

  app.delete<{
    Params: { experimentId: string; variantId: string };
  }>("/experiments/:experimentId/variants/:variantId", async (request, reply) => {
    const { experimentId, variantId } = request.params;

    const metadata = {
      attempted: false,
      succeeded: false,
      error: undefined as string | undefined,
    };

    try {
      const variant = await experimentService.deleteVariant(variantId);

      const experiment = await experimentService.getById(experimentId);
      if (experiment?.status === "RUNNING") {
        metadata.attempted = true;
        try {
          await configPublisher.publish(experiment.environmentId);
          metadata.succeeded = true;
        } catch (err: unknown) {
          metadata.error = err instanceof Error ? err.message : "Unknown error";
        }
      }

      setPublishMetadataHeaders(reply, metadata);
      return reply.send(variant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Record to delete does not exist")) {
        return reply.status(404).send({ error: "Variant not found" });
      }
      throw err;
    }
  });
}
