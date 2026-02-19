import type { FastifyInstance } from "fastify";

export function registerHealthRoute(
  app: FastifyInstance,
  experimentServiceUrl: string,
  decisionServiceUrl: string
) {
  app.get("/health", async (_request, reply) => {
    const checks: Record<string, string> = {};

    try {
      const expRes = await fetch(`${experimentServiceUrl}/health`);
      checks.experiment_service = expRes.ok ? "ok" : "unhealthy";
    } catch {
      checks.experiment_service = "unreachable";
    }

    try {
      const decRes = await fetch(`${decisionServiceUrl}/health`);
      checks.decision_service = decRes.ok ? "ok" : "unhealthy";
    } catch {
      checks.decision_service = "unreachable";
    }

    const healthy = Object.values(checks).every((status) => status === "ok");
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      services: checks,
    });
  });
}
