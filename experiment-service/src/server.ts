import Fastify from "fastify";
import { environmentRoutes } from "./routes/environments.js";
import { experimentRoutes } from "./routes/experiments.js";
import { audienceRoutes } from "./routes/audiences.js";
import { variantRoutes } from "./routes/variants.js";
import { allocationRoutes } from "./routes/allocations.js";

export function buildServer() {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(environmentRoutes);
  app.register(experimentRoutes);
  app.register(audienceRoutes);
  app.register(variantRoutes);
  app.register(allocationRoutes);

  return app;
}
