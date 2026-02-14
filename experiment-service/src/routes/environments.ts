import type { FastifyInstance } from "fastify";
import {
  createEnvironmentSchema,
  listEnvironmentsSchema,
} from "@experiments/shared";
import { environmentService } from "../services/environment.service.js";

export async function environmentRoutes(app: FastifyInstance) {
  app.post("/environments", async (request, reply) => {
    const parsed = createEnvironmentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    try {
      const environment = await environmentService.create(parsed.data);
      return reply.status(201).send(environment);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Unique constraint")) {
        return reply.status(409).send({
          error: `Environment with name "${parsed.data.name}" already exists`,
        });
      }
      throw err;
    }
  });

  app.get("/environments", async (request, reply) => {
    const parsed = listEnvironmentsSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const result = await environmentService.list(parsed.data);
    return reply.send(result);
  });

  app.get<{
    Params: { id: string };
  }>("/environments/:id", async (request, reply) => {
    const environment = await environmentService.getById(request.params.id);

    if (!environment) {
      return reply.status(404).send({ error: "Environment not found" });
    }

    return reply.send(environment);
  });
}
