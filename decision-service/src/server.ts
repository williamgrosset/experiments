import Fastify from "fastify";
import { ConfigStore } from "./services/config-store.js";
import { decideRoutes } from "./routes/decide.js";

export function buildServer(environments?: string[]) {
  const envs = environments ?? [];
  const configStore = new ConfigStore(envs);

  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => {
    const configs: Record<string, number | null> = {};
    for (const env of configStore.listTrackedEnvironments()) {
      const config = configStore.getConfig(env);
      configs[env] = config?.version ?? null;
    }
    return {
      status: "ok",
      config_versions: configs,
    };
  });

  app.register(decideRoutes, { configStore });

  // Start config store before server begins accepting requests
  app.addHook("onReady", async () => {
    await configStore.start();
  });

  // Clean up config store on shutdown
  app.addHook("onClose", async () => {
    await configStore.stop();
  });

  return app;
}
