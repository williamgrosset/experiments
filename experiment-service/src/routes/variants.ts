import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { CreateVariantRequest } from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";

export async function variantRoutes(app: FastifyInstance) {
  app.post<{
    Params: { experimentId: string };
    Body: CreateVariantRequest;
  }>("/experiments/:experimentId/variants", async (request, reply) => {
    const { experimentId } = request.params;
    const { key, name, payload } = request.body;

    if (!key || !name) {
      return reply
        .status(400)
        .send({ error: "key and name are required" });
    }

    try {
      const variant = await experimentService.addVariant(experimentId, {
        key,
        name,
        payload: payload as unknown as Prisma.InputJsonValue,
      });
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
}
