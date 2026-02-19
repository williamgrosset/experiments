import type { FastifyInstance } from "fastify";
import proxy from "@fastify/http-proxy";

export function registerControlPlaneRoutes(
  app: FastifyInstance,
  experimentServiceUrl: string
) {
  app.register(proxy, {
    upstream: experimentServiceUrl,
    prefix: "/api/experiments",
    rewritePrefix: "/experiments",
  });

  app.register(proxy, {
    upstream: experimentServiceUrl,
    prefix: "/api/environments",
    rewritePrefix: "/environments",
  });
}
