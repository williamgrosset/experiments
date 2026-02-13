import Fastify from "fastify";
import proxy from "@fastify/http-proxy";

const EXPERIMENT_SERVICE_URL =
  process.env.EXPERIMENT_SERVICE_URL || "http://localhost:3001";
const DECISION_SERVICE_URL =
  process.env.DECISION_SERVICE_URL || "http://localhost:3002";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  // Health check — pings both upstream services
  app.get("/health", async (_request, reply) => {
    const checks: Record<string, string> = {};

    try {
      const expRes = await fetch(`${EXPERIMENT_SERVICE_URL}/health`);
      checks.experiment_service = expRes.ok ? "ok" : "unhealthy";
    } catch {
      checks.experiment_service = "unreachable";
    }

    try {
      const decRes = await fetch(`${DECISION_SERVICE_URL}/health`);
      checks.decision_service = decRes.ok ? "ok" : "unhealthy";
    } catch {
      checks.decision_service = "unreachable";
    }

    const healthy = Object.values(checks).every((s) => s === "ok");
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      services: checks,
    });
  });

  // Proxy /api/experiments/* and /api/environments/* → experiment-service
  app.register(proxy, {
    upstream: EXPERIMENT_SERVICE_URL,
    prefix: "/api/experiments",
    rewritePrefix: "/experiments",
  });

  app.register(proxy, {
    upstream: EXPERIMENT_SERVICE_URL,
    prefix: "/api/environments",
    rewritePrefix: "/environments",
  });

  // Proxy /api/decide → decision-service
  app.register(proxy, {
    upstream: DECISION_SERVICE_URL,
    prefix: "/api/decide",
    rewritePrefix: "/decide",
  });

  return app;
}
