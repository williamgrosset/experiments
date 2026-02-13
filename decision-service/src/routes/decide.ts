import type { FastifyInstance } from "fastify";
import type { DecideResponse } from "@experiments/shared";
import type { ConfigStore } from "../services/config-store.js";
import { assignVariants } from "../services/assigner.js";

export async function decideRoutes(
  app: FastifyInstance,
  opts: { configStore: ConfigStore }
) {
  const { configStore } = opts;

  app.get<{
    Querystring: {
      user_key: string;
      env: string;
      context?: string; // JSON-encoded context object
    };
  }>("/decide", async (request, reply) => {
    const { user_key, env } = request.query;

    if (!user_key || !env) {
      return reply
        .status(400)
        .send({ error: "user_key and env are required query parameters" });
    }

    const config = configStore.getConfig(env);

    if (!config) {
      return reply.status(503).send({
        error: `No config available for environment "${env}"`,
      });
    }

    // Parse optional context
    let context: Record<string, unknown> = {};
    if (request.query.context) {
      try {
        context = JSON.parse(request.query.context);
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
