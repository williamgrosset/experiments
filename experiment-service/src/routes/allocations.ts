import type { FastifyInstance } from "fastify";
import { setAllocationsSchema } from "@experiments/shared";
import { experimentService } from "../services/experiment.service.js";
import { configPublisher } from "../services/config-publisher.js";
import { setPublishMetadataHeaders } from "../lib/http/publish-metadata.js";

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

      const metadata = {
        attempted: false,
        succeeded: false,
        error: undefined as string | undefined,
      };

      try {
        const result = await experimentService.setAllocations(
          experimentId,
          allocations
        );

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
