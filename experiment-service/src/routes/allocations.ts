import type { FastifyInstance } from "fastify";
import { setAllocationsSchema } from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";
import { configPublisher } from "../services/config-publisher.js";

export async function allocationRoutes(app: FastifyInstance) {
  app.put<{
    Params: { experimentId: string };
  }>(
    "/experiments/:experimentId/allocations",
    async (request, reply) => {
      const { experimentId } = request.params;
      const parsed = setAllocationsSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0].message });
      }

      const { allocations } = parsed.data;

      let result: Awaited<ReturnType<typeof experimentService.setAllocations>>;

      try {
        result = await experimentService.setAllocations(experimentId, allocations);
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

      const experiment = await experimentService.getById(experimentId);
      if (experiment?.status === "RUNNING") {
        try {
          await configPublisher.publish(experiment.environmentId);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return reply.status(500).send({
            error: `Allocations updated but failed to publish config: ${message}`,
          });
        }
      }

      return reply.send(result);
    }
  );
}
