import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  listAudiencesSchema,
  createAudienceSchema,
  updateAudienceSchema,
} from "@experiments/shared";
import { audienceService } from "../services/audience.service.js";
import { configPublisher } from "../services/config-publisher.js";
import { setPublishMetadataHeaders } from "../lib/http/publish-metadata.js";

export async function audienceRoutes(app: FastifyInstance) {
  app.post("/audiences", async (request, reply) => {
    const parsed = createAudienceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { name, environmentId, rules } = parsed.data;

    try {
      const audience = await audienceService.create({
        name,
        environmentId,
        rules: rules as unknown as Prisma.InputJsonValue,
      });

      return reply.status(201).send(audience);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Unique constraint")) {
        return reply.status(409).send({
          error: `Audience with name "${name}" already exists in this environment`,
        });
      }
      if (message.includes("Foreign key constraint")) {
        return reply.status(404).send({ error: "Environment not found" });
      }
      throw err;
    }
  });

  app.get("/audiences", async (request, reply) => {
    const parsed = listAudiencesSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const result = await audienceService.list(parsed.data);
    return reply.send(result);
  });

  app.get<{
    Params: { id: string };
  }>("/audiences/:id", async (request, reply) => {
    const audience = await audienceService.getById(request.params.id);

    if (!audience) {
      return reply.status(404).send({ error: "Audience not found" });
    }

    return reply.send(audience);
  });

  app.patch<{
    Params: { id: string };
  }>("/audiences/:id", async (request, reply) => {
    const parsed = updateAudienceSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { name, rules } = parsed.data;
    const shouldPublish = rules !== undefined;
    const metadata = {
      attempted: false,
      succeeded: false,
      error: undefined as string | undefined,
    };

    try {
      const audience = await audienceService.update(request.params.id, {
        name,
        rules: rules as unknown as Prisma.InputJsonValue,
      });

      if (shouldPublish) {
        const hasRunningExperiments = await audienceService.hasRunningExperiments(
          audience.id
        );

        if (hasRunningExperiments) {
          metadata.attempted = true;
          try {
            await configPublisher.publish(audience.environmentId);
            metadata.succeeded = true;
          } catch (err: unknown) {
            metadata.error = err instanceof Error ? err.message : "Unknown error";
          }
        }
      }

      setPublishMetadataHeaders(reply, metadata);
      return reply.send(audience);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Record to update not found")) {
        return reply.status(404).send({ error: "Audience not found" });
      }
      if (message.includes("Unique constraint")) {
        return reply.status(409).send({
          error: `Audience with name "${name}" already exists in this environment`,
        });
      }
      throw err;
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/audiences/:id", async (request, reply) => {
    const metadata = {
      attempted: false,
      succeeded: false,
      error: undefined as string | undefined,
    };

    try {
      const hasRunningExperiments = await audienceService.hasRunningExperiments(
        request.params.id
      );
      const audience = await audienceService.delete(request.params.id);

      if (hasRunningExperiments) {
        metadata.attempted = true;
        try {
          await configPublisher.publish(audience.environmentId);
          metadata.succeeded = true;
        } catch (err: unknown) {
          metadata.error = err instanceof Error ? err.message : "Unknown error";
        }
      }

      setPublishMetadataHeaders(reply, metadata);
      return reply.send(audience);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Record to delete does not exist")) {
        return reply.status(404).send({ error: "Audience not found" });
      }
      throw err;
    }
  });
}
