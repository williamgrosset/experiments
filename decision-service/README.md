# Decision Service

The decision plane for the experimentation platform. Provides low-latency, deterministic variant assignment for users. Reads config snapshots from an in-memory cache populated by polling S3 (MinIO locally).

## Responsibilities

- Serve variant assignments via `GET /decide`
- Maintain an in-memory config snapshot per environment
- Poll S3 for config updates via lightweight version checks
- Evaluate targeting rules against user context
- Deterministic bucketing using MurmurHash3

## How It Works

### Config Loading

On startup, the service attempts to load the latest config snapshot for each environment from S3. It then polls S3 every 5 seconds using a lightweight version check (`version.json`), only fetching the full snapshot when the version changes.

When a new config is discovered, the service swaps the in-memory reference atomically — no locks, no read-during-write issues.

If S3 is unreachable, the service continues serving from the last known in-memory config.

### Decision Flow

For each `GET /decide` request:

1. Load the config snapshot for the requested environment from memory
2. For each experiment in the config:
   - Evaluate targeting rules against the provided context (if any rules exist)
   - Compute a deterministic bucket: `hash(user_key + experiment_salt) % 10,000`
   - Map the bucket to a variant via allocation ranges
3. Return all assignments

### Deterministic Bucketing

- Uses MurmurHash v3 for fast, uniform distribution
- 10,000 buckets (0-9999) for 0.01% allocation granularity
- Same `user_key` + `experiment_salt` always produces the same bucket
- Stable across sessions, restarts, and service instances

### Targeting Rules

Rules use first-match semantics:
- If **any** rule matches, the user is eligible (OR across rules)
- Within a rule, **all** conditions must match (AND within a rule)
- If there are no rules, everyone is eligible

Supported operators: `eq`, `neq`, `in`, `notIn`, `contains`, `gt`, `lt`

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/decide` | Assign variants for a user |
| `GET` | `/health` | Health check with config versions |

### `GET /decide`

**Query parameters:**

| Param | Required | Description |
|---|---|---|
| `user_key` | Yes | Unique user identifier |
| `env` | Yes | Environment name (e.g. `prod`) |
| `context` | No | JSON-encoded object for targeting rule evaluation |

**Example:**

```bash
curl -sG "http://localhost:3002/decide" \
  --data-urlencode "user_key=user-123" \
  --data-urlencode "env=prod" \
  | jq
```

**Response:**

```json
{
  "user_key": "user-123",
  "environment": "prod",
  "config_version": 1,
  "assignments": [
    {
      "experiment_key": "checkout-button-color",
      "experiment_id": "abc-123",
      "variant_key": "control",
      "variant_id": "def-456",
      "payload": {"color": "#0066cc"}
    }
  ]
}
```

**With targeting context:**

```bash
curl -sG "http://localhost:3002/decide" \
  --data-urlencode "user_key=user-123" \
  --data-urlencode "env=prod" \
  --data-urlencode 'context={"country":"US"}' \
  | jq
```

### `GET /health`

Returns config version per environment:

```json
{
  "status": "ok",
  "config_versions": {
    "dev": null,
    "staging": null,
    "prod": 3
  }
}
```

A `null` version means no config has been published for that environment yet.

## Running

### Prerequisites

MinIO must be running. From the repo root:

```bash
docker compose up -d
```

### Development

```bash
pnpm dev:decision
```

Starts on port `3002` by default (configurable via `DECISION_SERVICE_PORT`).

### Build

```bash
pnpm --filter decision-service run build
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CONFIG_BASE_URL` | `http://localhost:9000/experiment-configs` | Base URL for config snapshots (CDN in production, MinIO locally) |
| `DECISION_SERVICE_PORT` | `3002` | HTTP port |
