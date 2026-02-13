# Experiments

An experimentation platform for managing feature flags and A/B tests with deterministic, low-latency variant assignment.

## Architecture

The platform is split into two planes:

- **Control Plane** (`experiment-service`) — CRUD operations for experiments, variants, allocations, and targeting rules. Writes to Postgres and publishes compiled config snapshots to Redis.
- **Decision Plane** (`decision-service`) — Stateless, low-latency variant assignment. Reads config from an in-memory cache populated via Redis Pub/Sub.
- **API Gateway** (`api-gateway`) — Thin reverse proxy that routes external traffic to the appropriate service.

```
                         ┌──────────────┐
                         │  API Gateway │ :3000
                         └──────┬───────┘
                        ┌───────┴────────┐
                        │                │
               /api/experiments    /api/decide
               /api/environments         │
                        │                │
              ┌─────────▼──────┐  ┌──────▼──────────┐
              │  Experiment    │  │  Decision        │
              │  Service :3001 │  │  Service :3002   │
              └───────┬────────┘  └──────┬───────────┘
                      │                  │
               ┌──────▼──────┐    ┌──────▼──────┐
               │  Postgres   │    │    Redis     │
               │  (source of │◄───┤  (config     │
               │   truth)    │    │   snapshots) │
               └─────────────┘    └──────────────┘
```

## Tech Stack

- **TypeScript** with strict mode, ESM, NodeNext resolution
- **Fastify** for HTTP servers
- **Prisma** for database access (experiment-service only)
- **Redis** (ioredis) for config distribution and Pub/Sub
- **Docker Compose** for local infrastructure (Postgres, Redis)
- **pnpm workspaces** for monorepo management

## Prerequisites

- Node.js >= 20
- pnpm
- Docker and Docker Compose

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up postgres redis -d
```

### 3. Set up the database

```bash
pnpm --filter experiment-service run db:push
```

### 4. Start the services

```bash
pnpm dev
```

This starts all three services concurrently with hot-reload. You can also run them individually:

```bash
pnpm dev:experiment   # starts on :3001
pnpm dev:decision     # starts on :3002
pnpm dev:gateway      # starts on :3000
```

## Running the Flows

Below is a complete walkthrough: create an environment, set up an experiment with variants and allocations, publish the config, and request a decision.

### Step 1: Create an environment

```bash
curl -s -X POST http://localhost:3000/api/environments \
  -H "Content-Type: application/json" \
  -d '{"name": "prod"}' | jq
```

Save the returned `id` — you'll need it as `ENV_ID` below.

### Step 2: Create an experiment

```bash
curl -s -X POST http://localhost:3000/api/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "key": "checkout-button-color",
    "name": "Checkout Button Color Test",
    "description": "Test whether a green button improves checkout conversion",
    "environmentId": "ENV_ID"
  }' | jq
```

Save the returned `id` as `EXP_ID`.

### Step 3: Add variants

```bash
# Control variant
curl -s -X POST http://localhost:3000/api/experiments/EXP_ID/variants \
  -H "Content-Type: application/json" \
  -d '{
    "key": "control",
    "name": "Blue Button",
    "payload": {"color": "#0066cc"}
  }' | jq

# Treatment variant
curl -s -X POST http://localhost:3000/api/experiments/EXP_ID/variants \
  -H "Content-Type: application/json" \
  -d '{
    "key": "treatment",
    "name": "Green Button",
    "payload": {"color": "#00cc66"}
  }' | jq
```

Save the returned variant `id` values as `CONTROL_ID` and `TREATMENT_ID`.

### Step 4: Set allocation ranges

Allocations map buckets (0-9999) to variants. A 50/50 split:

```bash
curl -s -X PUT http://localhost:3000/api/experiments/EXP_ID/allocations \
  -H "Content-Type: application/json" \
  -d '{
    "allocations": [
      {"variantId": "CONTROL_ID", "rangeStart": 0, "rangeEnd": 4999},
      {"variantId": "TREATMENT_ID", "rangeStart": 5000, "rangeEnd": 9999}
    ]
  }' | jq
```

### Step 5: Start the experiment

Transition the experiment from `DRAFT` to `RUNNING`:

```bash
curl -s -X PATCH http://localhost:3000/api/experiments/EXP_ID/status \
  -H "Content-Type: application/json" \
  -d '{"status": "RUNNING"}' | jq
```

### Step 6: Publish the config

This compiles all running experiments in the environment into a config snapshot and writes it to Redis:

```bash
curl -s -X POST http://localhost:3000/api/experiments/EXP_ID/publish | jq
```

### Step 7: Request a decision

The decision service uses the published config to deterministically assign variants:

```bash
curl -s "http://localhost:3000/api/decide?user_key=user-123&env=prod" | jq
```

Response:

```json
{
  "user_key": "user-123",
  "environment": "prod",
  "config_version": 1,
  "assignments": [
    {
      "experiment_key": "checkout-button-color",
      "experiment_id": "...",
      "variant_key": "control",
      "variant_id": "...",
      "payload": {"color": "#0066cc"}
    }
  ]
}
```

The same `user_key` always returns the same variant (deterministic hashing). Different user keys will be distributed across variants according to the allocation ranges.

### Targeting rules (optional)

You can add targeting rules to restrict which users are eligible for an experiment:

```bash
curl -s -X PATCH http://localhost:3000/api/experiments/EXP_ID \
  -H "Content-Type: application/json" \
  -d '{
    "targetingRules": [
      {
        "conditions": [
          {"attribute": "country", "operator": "in", "value": ["US", "CA"]},
          {"attribute": "plan", "operator": "eq", "value": "pro"}
        ]
      }
    ]
  }' | jq
```

Then pass context with the decide call:

```bash
curl -s "http://localhost:3000/api/decide?user_key=user-123&env=prod&context=%7B%22country%22%3A%22US%22%2C%22plan%22%3A%22pro%22%7D" | jq
```

## Gateway Routing

| Gateway path | Upstream |
|---|---|
| `/api/experiments/*` | `experiment-service:3001/experiments/*` |
| `/api/environments/*` | `experiment-service:3001/environments/*` |
| `/api/decide*` | `decision-service:3002/decide*` |
| `/health` | Aggregated health from both services |

## Project Structure

```
experiments/
├── packages/shared/          # Shared types and hashing utility
|—— dashboard/                # Dashboard for experiment CRUD
├── experiment-service/       # Control plane (Prisma + Postgres + Redis)
├── decision-service/         # Decision plane (in-memory config + Redis Pub/Sub)
├── api-gateway/              # Reverse proxy
└── docker-compose.yml        # Local infrastructure (Postgres, Redis)
```

See each service's README for more detail.