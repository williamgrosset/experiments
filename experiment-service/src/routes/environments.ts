import type { FastifyInstance } from "fastify";
import { createEnvironmentSchema } from "@experiments/shared";
import { prisma } from "../lib/prisma.js";

export async function environmentRoutes(app: FastifyInstance) {
  app.post("/environments", async (request, reply) => {
    const parsed = createEnvironmentSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0].message });
    }

    const { name } = parsed.data;

    const environment = await prisma.environment.create({
      data: { name },
    });

    return reply.status(201).send(environment);
  });

  app.get("/environments", async (_request, reply) => {
    const environments = await prisma.environment.findMany({
      orderBy: { name: "asc" },
    });
    return reply.send(environments);
  });

  app.get<{
    Params: { id: string };
  }>("/environments/:id", async (request, reply) => {
    const environment = await prisma.environment.findUnique({
      where: { id: request.params.id },
    });

    if (!environment) {
      return reply.status(404).send({ error: "Environment not found" });
    }

    return reply.send(environment);
  });
}
