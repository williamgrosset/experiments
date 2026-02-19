import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

interface RouteRateLimitConfig {
  enabled: boolean;
  max: number;
  timeWindow: number;
  allowList: string[];
  routeLabel: string;
}

export async function applyRouteRateLimit(
  app: FastifyInstance,
  config: RouteRateLimitConfig
) {
  if (!config.enabled) {
    return;
  }

  await app.register(rateLimit, {
    global: true,
    max: config.max,
    timeWindow: config.timeWindow,
    keyGenerator: (request) => request.ip,
    allowList: config.allowList,
    errorResponseBuilder: (_request, context) => ({
      error: "Too Many Requests",
      message: `Rate limit exceeded, retry in ${context.after}`,
      statusCode: 429,
    }),
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (reply.statusCode === 429) {
      request.log.warn(
        {
          path: request.url,
          clientIp: request.ip,
          route: config.routeLabel,
          maxPerWindow: config.max,
          windowMs: config.timeWindow,
          limit: reply.getHeader("x-ratelimit-limit"),
          remaining: reply.getHeader("x-ratelimit-remaining"),
          reset: reply.getHeader("x-ratelimit-reset"),
        },
        "Rate limit exceeded"
      );
    }

    return payload;
  });
}
