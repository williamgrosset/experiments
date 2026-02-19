import Fastify from "fastify";
import { registerControlPlaneRoutes } from "./routes/control-plane.js";
import { registerDecideRoutes } from "./routes/decide.js";
import { registerHealthRoute } from "./routes/health.js";

const EXPERIMENT_SERVICE_URL =
  process.env.EXPERIMENT_SERVICE_URL || "http://localhost:3001";
const DECISION_SERVICE_URL =
  process.env.DECISION_SERVICE_URL || "http://localhost:3002";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  registerHealthRoute(app, EXPERIMENT_SERVICE_URL, DECISION_SERVICE_URL);
  registerControlPlaneRoutes(app, EXPERIMENT_SERVICE_URL);
  registerDecideRoutes(app, DECISION_SERVICE_URL);

  return app;
}
