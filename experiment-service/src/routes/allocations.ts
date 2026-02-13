import type { FastifyInstance } from "fastify";
import type { SetAllocationsRequest } from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";

export async function allocationRoutes(app: FastifyInstance) {
  app.put<{
    Params: { experimentId: string };
    Body: SetAllocationsRequest;
  }>(
    "/experiments/:experimentId/allocations",
    async (request, reply) => {
      const { experimentId } = request.params;
      const { allocations } = request.body;

      if (!Array.isArray(allocations)) {
        return reply
          .status(400)
          .send({ error: "allocations array is required" });
      }

      try {
        const result = await experimentService.setAllocations(
          experimentId,
          allocations
        );
        return reply.send(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (
          message.includes("Invalid range") ||
          message.includes("must not overlap")
        ) {
          return reply.status(400).send({ error: message });
        }
        throw err;
      }
    }
  );
}