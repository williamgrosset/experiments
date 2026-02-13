import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function environmentRoutes(app: FastifyInstance) {
  app.post<{
    Body: { name: string };
  }>("/environments", async (request, reply) => {
    const { name } = request.body;

    if (!name || typeof name !== "string") {
      return reply.status(400).send({ error: "name is required" });
    }

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
