import type { FastifyInstance } from "fastify";
import proxy from "@fastify/http-proxy";
import { applyRouteRateLimit } from "../lib/rate-limit.js";

const DEFAULT_MAX_REQUESTS = 300;
const DEFAULT_WINDOW_MS = 60_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDecideRateLimitConfig() {
  return {
    enabled: process.env.DECIDE_RATE_LIMIT_ENABLED !== "false",
    max: parsePositiveInt(process.env.DECIDE_RATE_LIMIT_MAX, DEFAULT_MAX_REQUESTS),
    timeWindow: parsePositiveInt(
      process.env.DECIDE_RATE_LIMIT_WINDOW_MS,
      DEFAULT_WINDOW_MS
    ),
    allowList: (process.env.DECIDE_RATE_LIMIT_ALLOWLIST || "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
  };
}

export function registerDecideRoutes(
  app: FastifyInstance,
  decisionServiceUrl: string
) {
  const rateLimitConfig = getDecideRateLimitConfig();

  app.register(async (decideScope) => {
    await applyRouteRateLimit(decideScope, {
      ...rateLimitConfig,
      routeLabel: "/api/decide",
    });

    decideScope.register(proxy, {
      upstream: decisionServiceUrl,
      prefix: "/api/decide",
      rewritePrefix: "/decide",
    });
  });
}
