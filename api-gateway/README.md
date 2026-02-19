# API Gateway

A thin reverse proxy that routes external traffic to the experiment service and decision service. Built with Fastify and `@fastify/http-proxy`.

## Responsibilities

- Route requests to the correct upstream service based on path prefix
- Provide an aggregated health check endpoint
- Single entry point for all API consumers

## Routing

| Incoming path | Upstream | Rewritten to |
|---|---|---|
| `/api/experiments/*` | `experiment-service:3001` | `/experiments/*` |
| `/api/environments/*` | `experiment-service:3001` | `/environments/*` |
| `/api/decide*` | `decision-service:3002` | `/decide*` |
| `/health` | Local | Pings both upstream `/health` endpoints |

All routes are prefixed with `/api` at the gateway level. The prefix is stripped when forwarding to the upstream service.

## Health Check

`GET /health` pings both upstream services and returns an aggregated status:

```json
{
  "status": "ok",
  "services": {
    "experiment_service": "ok",
    "decision_service": "ok"
  }
}
```

Returns `503` with `"status": "degraded"` if any upstream is unreachable or unhealthy.

## Running

### Prerequisites

The experiment service and decision service should be running.

### Development

```bash
pnpm dev:gateway
```

Starts on port `3000` by default (configurable via `API_GATEWAY_PORT`).

### Build

```bash
pnpm --filter api-gateway run build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_GATEWAY_PORT` | `3000` | HTTP port |
| `EXPERIMENT_SERVICE_URL` | `http://localhost:3001` | Experiment service upstream URL |
| `DECISION_SERVICE_URL` | `http://localhost:3002` | Decision service upstream URL |
| `DECIDE_RATE_LIMIT_ENABLED` | `true` | Enable rate limiting for `/api/decide` |
| `DECIDE_RATE_LIMIT_MAX` | `300` | Max requests per client IP per window for `/api/decide` |
| `DECIDE_RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window duration in milliseconds |
| `DECIDE_RATE_LIMIT_ALLOWLIST` | `` | Comma-separated client IPs excluded from `/api/decide` limits |
