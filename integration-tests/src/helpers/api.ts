/**
 * HTTP helpers for integration tests.
 *
 * Wraps the experiment-service and decision-service REST APIs
 * with typed request/response functions for test readability.
 */

const EXPERIMENT_SERVICE_URL =
  process.env.EXPERIMENT_SERVICE_URL ?? "http://localhost:3001";
const DECISION_SERVICE_URL =
  process.env.DECISION_SERVICE_URL ?? "http://localhost:3002";

// ---------------------------------------------------------------------------
// Generic fetch wrapper
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  status: number;
  data: T;
}

async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as T;
  return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Experiment-service helpers
// ---------------------------------------------------------------------------

export interface Environment {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description: string | null;
  salt: string;
  status: string;
  environmentId: string;
  variants: Variant[];
  allocations: Allocation[];
  environment: Environment;
}

export interface Variant {
  id: string;
  key: string;
  name: string;
  payload: Record<string, unknown> | null;
  experimentId: string;
}

export interface Allocation {
  id: string;
  variantId: string;
  rangeStart: number;
  rangeEnd: number;
  experimentId: string;
}

export interface ConfigSnapshot {
  version: number;
  environment: string;
  publishedAt: string;
  experiments: Array<{
    id: string;
    key: string;
    salt: string;
    targetingRules: unknown[];
    variants: Array<{ id: string; key: string; payload?: Record<string, unknown> }>;
    allocations: Array<{ variantId: string; rangeStart: number; rangeEnd: number }>;
  }>;
}

export function createEnvironment(name: string) {
  return request<Environment>(
    EXPERIMENT_SERVICE_URL,
    "POST",
    "/environments",
    { name }
  );
}

export function createExperiment(params: {
  key: string;
  name: string;
  description?: string;
  environmentId: string;
}) {
  return request<Experiment>(
    EXPERIMENT_SERVICE_URL,
    "POST",
    "/experiments",
    params
  );
}

export function addVariant(
  experimentId: string,
  params: { key: string; name: string; payload?: Record<string, unknown> }
) {
  return request<Variant>(
    EXPERIMENT_SERVICE_URL,
    "POST",
    `/experiments/${experimentId}/variants`,
    params
  );
}

export function setAllocations(
  experimentId: string,
  allocations: Array<{
    variantId: string;
    rangeStart: number;
    rangeEnd: number;
  }>
) {
  return request<Allocation[]>(
    EXPERIMENT_SERVICE_URL,
    "PUT",
    `/experiments/${experimentId}/allocations`,
    { allocations }
  );
}

export function updateExperimentStatus(
  experimentId: string,
  status: string
) {
  return request<Experiment>(
    EXPERIMENT_SERVICE_URL,
    "PATCH",
    `/experiments/${experimentId}/status`,
    { status }
  );
}

export function updateExperiment(
  experimentId: string,
  params: {
    name?: string;
    description?: string;
    targetingRules?: Array<{
      conditions: Array<{
        attribute: string;
        operator: "eq" | "neq" | "in" | "notIn" | "contains" | "gt" | "lt";
        value: unknown;
      }>;
    }>;
  }
) {
  return request<Experiment>(
    EXPERIMENT_SERVICE_URL,
    "PATCH",
    `/experiments/${experimentId}`,
    params
  );
}

export function publishConfig(experimentId: string) {
  return request<ConfigSnapshot>(
    EXPERIMENT_SERVICE_URL,
    "POST",
    `/experiments/${experimentId}/publish`
  );
}

export function deleteExperiment(experimentId: string) {
  return request<Experiment>(
    EXPERIMENT_SERVICE_URL,
    "DELETE",
    `/experiments/${experimentId}`
  );
}

// ---------------------------------------------------------------------------
// Decision-service helpers
// ---------------------------------------------------------------------------

export interface Assignment {
  experiment_key: string;
  experiment_id: string;
  variant_key: string;
  variant_id: string;
  payload?: Record<string, unknown>;
}

export interface DecideResponse {
  user_key: string;
  environment: string;
  config_version: number;
  assignments: Assignment[];
}

export function decide(params: {
  userKey: string;
  env: string;
  context?: Record<string, unknown>;
}) {
  const query = new URLSearchParams({
    user_key: params.userKey,
    env: params.env,
  });
  if (params.context) {
    query.set("context", JSON.stringify(params.context));
  }
  return request<DecideResponse>(
    DECISION_SERVICE_URL,
    "GET",
    `/decide?${query.toString()}`
  );
}

// ---------------------------------------------------------------------------
// Health check helpers
// ---------------------------------------------------------------------------

/**
 * Poll the decision-service /decide endpoint until the config contains
 * a specific experiment key (i.e. S3 polling propagation is complete).
 * Returns as soon as the assignment appears instead of sleeping a fixed delay.
 */
export async function waitForConfigPropagation(params: {
  userKey: string;
  env: string;
  experimentKey: string;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<DecideResponse> {
  const { userKey, env, experimentKey } = params;
  const timeoutMs = params.timeoutMs ?? 10_000;
  const intervalMs = params.intervalMs ?? 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await decide({ userKey, env });
    if (
      res.status === 200 &&
      res.data.assignments.some((a) => a.experiment_key === experimentKey)
    ) {
      return res.data;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Config for experiment "${experimentKey}" did not propagate to ` +
      `decision-service within ${timeoutMs}ms`
  );
}

export async function waitForServices(
  timeoutMs = 10_000,
  intervalMs = 500
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const [expRes, decRes] = await Promise.all([
        fetch(`${EXPERIMENT_SERVICE_URL}/health`),
        fetch(`${DECISION_SERVICE_URL}/health`),
      ]);
      if (expRes.ok && decRes.ok) return;
    } catch {
      // Services not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Services did not become healthy within ${timeoutMs}ms. ` +
      `Ensure experiment-service (${EXPERIMENT_SERVICE_URL}) and ` +
      `decision-service (${DECISION_SERVICE_URL}) are running.`
  );
}
