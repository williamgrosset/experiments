import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  createExperimentSchema,
  updateExperimentSchema,
  updateExperimentStatusSchema,
  listExperimentsSchema,
} from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";
import { configPublisher } from "../services/config-publisher.js";

export async function experimentRoutes(app: FastifyInstance) {
  app.post("/experiments", async (request, reply) => {
    const parsed = createExperimentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { key, name, description, environmentId, targetingRules } =
      parsed.data;

    try {
      const experiment = await experimentService.create({
        key,
        name,
        description,
        environmentId,
        targetingRules: targetingRules as unknown as Prisma.InputJsonValue,
      });
      return reply.status(201).send(experiment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Unique constraint")) {
        return reply.status(409).send({
          error: `Experiment with key "${key}" already exists in this environment`,
        });
      }
      throw err;
    }
  });

  app.get("/experiments", async (request, reply) => {
    const parsed = listExperimentsSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const result = await experimentService.list(parsed.data);
    return reply.send(result);
  });

  app.get<{
    Params: { id: string };
  }>("/experiments/:id", async (request, reply) => {
    const experiment = await experimentService.getById(request.params.id);

    if (!experiment) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    return reply.send(experiment);
  });

  app.patch<{
    Params: { id: string };
  }>("/experiments/:id", async (request, reply) => {
    const parsed = updateExperimentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { name, description, targetingRules } = parsed.data;

    try {
      const experiment = await experimentService.update(request.params.id, {
        name,
        description,
        targetingRules: targetingRules as unknown as Prisma.InputJsonValue,
      });
      return reply.send(experiment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Record to update not found")) {
        return reply.status(404).send({ error: "Experiment not found" });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
  }>("/experiments/:id/status", async (request, reply) => {
    const parsed = updateExperimentStatusSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { status } = parsed.data;

    try {
      const experiment = await experimentService.updateStatus(
        request.params.id,
        status
      );
      return reply.send(experiment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not found")) {
        return reply.status(404).send({ error: message });
      }
      if (message.includes("Cannot transition")) {
        return reply.status(422).send({ error: message });
      }
      throw err;
    }
  });

  app.delete<{
    Params: { id: string };
  }>("/experiments/:id", async (request, reply) => {
    try {
      const experiment = await experimentService.delete(request.params.id);

      // Re-publish the config snapshot so the decision service
      // stops serving the deleted experiment.
      await configPublisher.publish(experiment.environmentId);

      return reply.send(experiment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not found")) {
        return reply.status(404).send({ error: "Experiment not found" });
      }
      throw err;
    }
  });

  app.post<{
    Params: { id: string };
  }>("/experiments/:id/publish", async (request, reply) => {
    const experiment = await experimentService.getById(request.params.id);

    if (!experiment) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    try {
      const snapshot = await configPublisher.publish(
        experiment.environmentId
      );
      return reply.send(snapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(500).send({ error: message });
    }
  });
}
