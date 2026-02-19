# Experiment Service

The control plane for the experimentation platform. Manages experiments, variants, allocations, and targeting rules. Writes to Postgres as the source of truth and publishes compiled config snapshots to S3 (MinIO locally) for the decision service.

## Responsibilities

- CRUD operations for environments and experiments
- Variant and allocation management
- Experiment lifecycle (DRAFT -> RUNNING -> PAUSED -> ARCHIVED)
- Config compilation and publishing to S3

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

### Targeting Rules

Targeting rules are stored on each experiment as an array of rules. Each rule has a `conditions` array:

```json
[
  {
    "conditions": [
      { "attribute": "country", "operator": "eq", "value": "US" },
      { "attribute": "age", "operator": "gt", "value": 18 }
    ]
  }
]
```

- Rules are ORed together (any matching rule makes the user eligible)
- Conditions inside a rule are ANDed together (all conditions must match)
- If `targetingRules` is empty or omitted, the experiment targets everyone

Supported operators: `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`.

### Audiences

Audiences are reusable targeting rule collections scoped to an environment.
Experiments can optionally reference an audience via `audienceId` while still
keeping their own `targetingRules`.

Rules are evaluated with AND semantics at assignment time:

- Audience rules must match (if an audience is attached)
- Experiment targeting rules must match (if present)

This lets you define broad reusable eligibility once (audience), then refine
per experiment without duplicating rule definitions.

Audience payload shape:

```json
{
  "name": "US Pro Users",
  "environmentId": "env-id",
  "rules": [
    {
      "conditions": [
        { "attribute": "country", "operator": "eq", "value": "US" },
        { "attribute": "plan", "operator": "in", "value": ["pro", "enterprise"] }
      ]
    }
  ]
}
```

## API Routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/environments` | Create an environment |
| `GET` | `/environments` | List environments (paginated) |
| `GET` | `/environments/:id` | Get environment by ID |
| `POST` | `/audiences` | Create an audience |
| `GET` | `/audiences` | List audiences (paginated, optional `environmentId` filter) |
| `GET` | `/audiences/:id` | Get audience by ID |
| `PATCH` | `/audiences/:id` | Update audience name and/or rules |
| `DELETE` | `/audiences/:id` | Delete audience |
| `POST` | `/experiments` | Create an experiment |
| `GET` | `/experiments` | List experiments (paginated, filter by `environmentId`, `status`) |
| `GET` | `/experiments/:id` | Get experiment with variants and allocations |
| `PATCH` | `/experiments/:id` | Update name, description, audience, or targeting rules |
| `PATCH` | `/experiments/:id/status` | Transition experiment status |
| `POST` | `/experiments/:id/variants` | Add a variant to an experiment |
| `PUT` | `/experiments/:experimentId/allocations` | Replace allocation ranges |
| `POST` | `/experiments/:id/publish` | Compile and publish config snapshot to S3 |
| `GET` | `/health` | Health check |

### Pagination

The `GET /environments` and `GET /experiments` endpoints return paginated responses with a consistent envelope:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Query parameters:

| Parameter | Type | Default | Constraints |
|---|---|---|---|
| `page` | integer | `1` | Must be >= 1 |
| `pageSize` | integer | `20` | Must be between 1 and 100 |

Both parameters must be provided together or omitted entirely. When omitted, defaults are applied. Providing only one returns a `400` error.

The `GET /experiments` endpoint also accepts optional filter parameters:

| Parameter | Type | Description |
|---|---|---|
| `environmentId` | string | Filter by environment ID |
| `status` | string | Filter by status (`DRAFT`, `RUNNING`, `PAUSED`, `ARCHIVED`) |

## Config Publishing

When you call `POST /experiments/:id/publish`:

1. Loads all `RUNNING` experiments for the experiment's environment
2. Compiles them into a `ConfigSnapshot` with pre-indexed experiments, variants, and allocations
3. Writes three objects to S3 in parallel:
   - `configs/{env}/snapshots/{version}.json` — immutable versioned snapshot
   - `configs/{env}/snapshots/latest.json` — the current snapshot
   - `configs/{env}/version.json` — lightweight version index for polling
4. Stores a `ConfigVersion` record in Postgres for audit

### Automatic publish triggers

The service also auto-publishes environment config snapshots after live-impacting mutations:

- Experiment status transitions (`PATCH /experiments/:id/status`)
- Targeting rule changes on `RUNNING` experiments (`PATCH /experiments/:id` with `targetingRules`)
- Audience changes with linked `RUNNING` experiments (`PATCH /audiences/:id` with `rules`)
- Audience deletion with linked `RUNNING` experiments (`DELETE /audiences/:id`)
- Variant creation on `RUNNING` experiments (`POST /experiments/:experimentId/variants`)
- Allocation updates on `RUNNING` experiments (`PUT /experiments/:experimentId/allocations`)
- Experiment deletion (`DELETE /experiments/:id`)

If a mutation succeeds but auto-publish fails, the API still returns success for the mutation and includes publish metadata in response headers:

- `x-publish-attempted`
- `x-publish-succeeded`
- `x-publish-error` (present only on publish failure)

## Running

### Prerequisites

Postgres and MinIO must be running. From the repo root:

```bash
docker compose up -d
```

### Setup

```bash
# Install dependencies (from repo root)
pnpm install

# Copy local environment variables
cp experiment-service/.env.example experiment-service/.env

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
| `S3_ENDPOINT` | `http://localhost:9000` | S3-compatible endpoint (MinIO locally) |
| `S3_BUCKET` | `experiment-configs` | S3 bucket for config snapshots |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |
| `S3_REGION` | `us-east-1` | S3 region |
| `EXPERIMENT_SERVICE_PORT` | `3001` | HTTP port |
