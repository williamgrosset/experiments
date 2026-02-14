# Experiments

An experimentation platform for managing feature flags and A/B tests with deterministic, low-latency variant assignment.

## Demo

![demo](https://github.com/user-attachments/assets/94ccaa95-0afe-47fb-8184-263c03ab67fe)

## Architecture

The platform is split into two planes:

- **Control Plane** (`experiment-service`) — CRUD operations for experiments, variants, allocations, and targeting rules. Writes to Postgres and publishes compiled config snapshots to S3 (MinIO locally).
- **Decision Plane** (`decision-service`) — Stateless, low-latency variant assignment. Reads config from an in-memory cache populated by polling S3.
- **API Gateway** (`api-gateway`) — Thin reverse proxy that routes external traffic to the appropriate service.
- **Dashboard** (`dashboard`) — Web UI for creating environments, managing experiments, and publishing configs.

![architecture-diagram](https://github.com/user-attachments/assets/5f0b1b01-52a9-4284-bfbf-bfeba9bd0e3a)

## Tech Stack

- **TypeScript** with strict mode, ESM, NodeNext resolution
- **Fastify** for HTTP servers
- **Prisma** for database access (experiment-service only)
- **S3** (MinIO locally) for config snapshot storage and distribution
- **Docker Compose** for local infrastructure (Postgres, MinIO)
- **pnpm workspaces** for monorepo management

## Todo

- [ ] User auth
- [ ] Rate limiting on /api/decide
- [ ] Observability & metrics
- [ ] Audience builder
- [ ] Archive experiment clean-up
- [ ] React SDK
- [ ] LLM-assisted workflow

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm
- Docker and Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up
```

### 3. Configure environment variables

```bash
cp experiment-service/.env.example experiment-service/.env
```

This provides the local Postgres connection string used by Prisma and `experiment-service`.

### 4. Set up the database

```bash
pnpm --filter experiment-service run db:push
```

### 5. Start the services

```bash
pnpm dev
```

This starts all backend services plus the dashboard concurrently with hot-reload. You can also run them individually:

```bash
pnpm dev:experiment   # starts on :3001
pnpm dev:decision     # starts on :3002
pnpm dev:gateway      # starts on :3000
pnpm dev:dashboard    # starts on :3100
```

After startup:

- API Gateway: `http://localhost:3000`
- Dashboard UI: `http://localhost:3100`

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

This compiles all running experiments in the environment into a config snapshot and writes it to S3:

```bash
curl -s -X POST http://localhost:3000/api/experiments/EXP_ID/publish | jq
```

### Step 7: Request a decision

The decision service uses the published config to deterministically assign variants:

```bash
curl -sG "http://localhost:3000/api/decide" \
  --data-urlencode "user_key=user-123" \
  --data-urlencode "env=prod" \
  | jq
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
curl -sG "http://localhost:3000/api/decide" \
  --data-urlencode "user_key=user-123" \
  --data-urlencode "env=prod" \
  --data-urlencode 'context={"country":"US","plan":"pro"}' \
  | jq
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
├── dashboard/                # Next.js UI for managing environments and experiments
├── experiment-service/       # Control plane (Prisma + Postgres + S3)
├── decision-service/         # Decision plane (in-memory config + S3 polling)
├── api-gateway/              # Reverse proxy
├── integration-tests/        # End-to-end and cross-service integration tests
└── docker-compose.yml        # Local infrastructure (Postgres, MinIO)
```

See each service's README for more detail.
