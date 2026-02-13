import type { FastifyInstance } from "fastify";
import type { ExperimentStatus, Prisma } from "@prisma/client";
import type {
  CreateExperimentRequest,
  UpdateExperimentRequest,
  UpdateExperimentStatusRequest,
} from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";
import { configPublisher } from "../services/config-publisher.js";

export async function experimentRoutes(app: FastifyInstance) {
  app.post<{
    Body: CreateExperimentRequest;
  }>("/experiments", async (request, reply) => {
    const { key, name, description, environmentId, targetingRules } = request.body;

    if (!key || !name || !environmentId) {
      return reply
        .status(400)
        .send({ error: "key, name, and environmentId are required" });
    }

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

  app.get<{
    Querystring: { environmentId?: string; status?: ExperimentStatus };
  }>("/experiments", async (request, reply) => {
    const { environmentId, status } = request.query;
    const experiments = await experimentService.list({
      environmentId,
      status,
    });
    return reply.send(experiments);
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
    Body: UpdateExperimentRequest;
  }>("/experiments/:id", async (request, reply) => {
    const { name, description, targetingRules } = request.body;

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
    Body: UpdateExperimentStatusRequest;
  }>("/experiments/:id/status", async (request, reply) => {
    const { status } = request.body;

    if (!status) {
      return reply.status(400).send({ error: "status is required" });
    }

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
