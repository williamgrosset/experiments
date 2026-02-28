# @experiments/react-sdk

First-party React SDK for the experiments platform. Fetches config snapshots from a CDN (backed by S3) and evaluates targeting rules and variant assignment locally in the browser — no API gateway roundtrip required.

Uses the same `assignVariants` and `evaluateTargetingRules` functions as the server-side decision-service (imported from `@experiments/shared`), guaranteeing identical evaluation behavior.

## Installation

```bash
pnpm add @experiments/react-sdk
```

React 18 or 19 is required as a peer dependency.

## Quick Start

Wrap your app with `ExperimentsProvider` and use hooks to read assignments:

```tsx
import { ExperimentsProvider, useExperiment } from "@experiments/react-sdk";

function App() {
  return (
    <ExperimentsProvider
      configUrl="https://cdn.example.com"
      environment="production"
      userKey={userId}
      context={{ country: "US", plan: "pro" }}
    >
      <Checkout />
    </ExperimentsProvider>
  );
}

function Checkout() {
  const { variant, payload, isReady } = useExperiment("checkout-flow");

  if (!isReady) return <Spinner />;
  if (variant === "treatment") return <NewCheckout config={payload} />;
  return <DefaultCheckout />;
}
```

## API

### `<ExperimentsProvider>`

Context provider that fetches the config snapshot, computes assignments, and starts polling for updates.

```tsx
<ExperimentsProvider
  configUrl="https://cdn.example.com"   // CDN base URL (required)
  environment="production"               // Environment name (required)
  userKey={userId}                       // Stable user ID for bucketing (required)
  context={{ country: "US" }}            // Targeting context (optional)
  pollingInterval={60000}                // Poll interval in ms, 0 to disable (default: 60000)
  initialSnapshot={snapshot}             // Pre-fetched snapshot for SSR (optional)
>
  {children}
</ExperimentsProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `configUrl` | `string` | — | Base URL where config snapshots are served (e.g., CloudFront distribution URL) |
| `environment` | `string` | — | Environment name (e.g., `"production"`, `"staging"`) |
| `userKey` | `string` | — | Stable user identifier for deterministic bucketing |
| `context` | `Record<string, unknown>` | `{}` | User context for targeting rule evaluation |
| `pollingInterval` | `number` | `60000` | Polling interval in ms. Set to `0` to disable polling. |
| `initialSnapshot` | `ConfigSnapshot` | — | Pre-fetched snapshot for SSR (skips client-side fetch) |

Assignments are re-evaluated synchronously when `userKey` or `context` changes — no additional network call needed.

### `useExperiment(experimentKey)`

Returns the assignment for a single experiment.

```tsx
const { variant, payload, isReady, isLoading, error } = useExperiment("checkout-flow");
```

| Field | Type | Description |
|---|---|---|
| `variant` | `string \| null` | Assigned variant key, or `null` if not assigned |
| `payload` | `Record<string, unknown> \| undefined` | Variant payload, if any |
| `isReady` | `boolean` | `true` once the initial config has loaded |
| `isLoading` | `boolean` | `true` while a config fetch is in progress |
| `error` | `Error \| null` | Error from the most recent fetch attempt |

### `useExperiments()`

Returns all experiment assignments as a flat record.

```tsx
const { assignments, isReady } = useExperiments();
// assignments = { "checkout-flow": { variant: "treatment", payload: { ... } } }
```

| Field | Type | Description |
|---|---|---|
| `assignments` | `Record<string, { variant: string; payload?: Record<string, unknown> }>` | All assignments keyed by experiment key |
| `isReady` | `boolean` | `true` once the initial config has loaded |
| `isLoading` | `boolean` | `true` while a config fetch is in progress |
| `error` | `Error \| null` | Error from the most recent fetch attempt |

### `<FeatureGate>`

Declarative render guard based on experiment assignment.

```tsx
<FeatureGate experiment="new-header" variant="treatment">
  <NewHeader />
</FeatureGate>

<FeatureGate
  experiment="pricing-test"
  variant={["variant-a", "variant-b"]}
  fallback={<DefaultPricing />}
>
  <ExperimentalPricing />
</FeatureGate>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `experiment` | `string` | — | Experiment key to check |
| `variant` | `string \| string[]` | — | Variant key(s) to match |
| `fallback` | `ReactNode` | `null` | Rendered when the user is not in the specified variant(s) |

### `fetchExperimentsConfig(configUrl, environment)`

Standalone async helper for server-side pre-fetching. No React dependency — use in `getServerSideProps`, server components, Remix loaders, etc.

```ts
const snapshot = await fetchExperimentsConfig(
  "https://cdn.example.com",
  "production"
);
```

Returns a `Promise<ConfigSnapshot>`.

## SSR / Next.js

Pre-fetch the config on the server and pass it as `initialSnapshot` to avoid a loading state on hydration:

```tsx
// app/layout.tsx (Next.js App Router)
import {
  ExperimentsProvider,
  fetchExperimentsConfig,
} from "@experiments/react-sdk";

export default async function RootLayout({ children }) {
  const snapshot = await fetchExperimentsConfig(
    process.env.EXPERIMENTS_CDN_URL,
    "production"
  );

  return (
    <ExperimentsProvider
      configUrl={process.env.EXPERIMENTS_CDN_URL}
      environment="production"
      userKey={getUserId()}
      initialSnapshot={snapshot}
    >
      {children}
    </ExperimentsProvider>
  );
}
```

When `initialSnapshot` is provided, the provider:
1. Renders immediately with assignments (no loading flash)
2. Seeds the poller with the snapshot's version number
3. Starts polling for updates in the background

## Config Polling

The SDK polls for config updates using a lightweight two-step process:

1. Fetch `version.json` (~50 bytes) at the configured interval
2. Only fetch the full `latest.json` snapshot if the version number has increased

Polling pauses automatically when the browser tab is hidden (Page Visibility API) and resumes with an immediate check when the tab becomes visible again.

This matches the same polling strategy used by the server-side decision-service, with two browser-specific adaptations:
- Configurable interval (default 60s vs server's 5s) to reduce bandwidth on user connections
- Tab visibility awareness to avoid unnecessary requests when the page isn't active

## Architecture

```
experiment-service
    |
    | publish (writes to S3)
    v
S3 bucket (experiment-configs)
    |
    v
CloudFront CDN (public read, cached)
    |
    v
@experiments/react-sdk (browser)
    |
    ├── ConfigFetcher (polls version.json, fetches latest.json on change)
    ├── assignVariants() from @experiments/shared
    ├── evaluateTargetingRules() from @experiments/shared
    |
    v
ExperimentsProvider (React context)
    |
    ├── useExperiment()
    ├── useExperiments()
    └── <FeatureGate>
```

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
pnpm test:watch
```
