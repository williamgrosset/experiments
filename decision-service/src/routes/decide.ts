import type { FastifyInstance } from "fastify";
import type { DecideResponse } from "@experiments/shared";
import { decideRequestSchema, assignVariants } from "@experiments/shared";
import type { ConfigStore } from "../services/config-store.js";

export async function decideRoutes(
  app: FastifyInstance,
  opts: { configStore: ConfigStore }
) {
  const { configStore } = opts;

  app.get("/decide", async (request, reply) => {
    const parsed = decideRequestSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.issues[0].message });
    }

    const { user_key, env } = parsed.data;

    await configStore.ensureEnvironment(env);

    const config = configStore.getConfig(env);

    if (!config) {
      return reply.status(503).send({
        error: `No config available for environment "${env}"`,
      });
    }

    // Parse optional context
    let context: Record<string, unknown> = {};
    if (parsed.data.context) {
      try {
        context = JSON.parse(parsed.data.context);
      } catch {
        return reply.status(400).send({ error: "Invalid context JSON" });
      }
    }

    const assignments = assignVariants(
      config.experiments,
      user_key,
      context
    );

    const response: DecideResponse = {
      user_key,
      environment: env,
      config_version: config.version,
      assignments,
    };

    return reply.send(response);
  });
}
