# Experiment Service

The control plane for the experimentation platform. Manages experiments, variants, allocations, and targeting rules. Writes to Postgres as the source of truth and publishes compiled config snapshots to Redis for the decision service.

## Responsibilities

- CRUD operations for environments and experiments
- Variant and allocation management
- Experiment lifecycle (DRAFT -> RUNNING -> PAUSED -> ARCHIVED)
- Config compilation and publishing to Redis

## Data Model

```
Environment
  └── Experiment (key unique per environment)
        ├── Variant[] (control, treatment_a, etc.)
        ├── Allocation[] (bucket ranges mapped to variants)
        └── targetingRules (JSON — audience conditions)

ConfigVersion (audit trail of published snapshots)
```

### Status Transitions

```
DRAFT ──► RUNNING ──► PAUSED
  │          │           │
  │          │           ▼
  └──────────┴───────► ARCHIVED
```

## API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/environments` | Create an environment |
| `GET` | `/environments` | List all environments |
| `GET` | `/environments/:id` | Get environment by ID |
| `POST` | `/experiments` | Create an experiment |
| `GET` | `/experiments` | List experiments (filter by `environmentId`, `status`) |
| `GET` | `/experiments/:id` | Get experiment with variants and allocations |
| `PATCH` | `/experiments/:id` | Update name, description, or targeting rules |
| `PATCH` | `/experiments/:id/status` | Transition experiment status |
| `POST` | `/experiments/:id/variants` | Add a variant to an experiment |
| `PUT` | `/experiments/:experimentId/allocations` | Replace allocation ranges |
| `POST` | `/experiments/:id/publish` | Compile and publish config snapshot to Redis |
| `GET` | `/health` | Health check |

## Config Publishing

When you call `POST /experiments/:id/publish`:

1. Loads all `RUNNING` experiments for the experiment's environment
2. Compiles them into a `ConfigSnapshot` with pre-indexed experiments, variants, and allocations
3. Writes the snapshot to Redis (`env:{name}:config`)
4. Stores a `ConfigVersion` record in Postgres for audit
5. Publishes a notification on the `config:updates` Redis Pub/Sub channel

## Running

### Prerequisites

Postgres and Redis must be running. From the repo root:

```bash
docker compose up postgres redis -d
```

### Setup

```bash
# Install dependencies (from repo root)
pnpm install

# Push the Prisma schema to the database
pnpm --filter experiment-service run db:push

# Or run a migration
pnpm --filter experiment-service run db:migrate
```

### Development

```bash
pnpm dev:experiment
```

Starts on port `3001` by default (configurable via `EXPERIMENT_SERVICE_PORT`).

### Build

```bash
pnpm --filter experiment-service run build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `EXPERIMENT_SERVICE_PORT` | `3001` | HTTP port |
