import type {
  Environment,
  Audience,
  Experiment,
  ExperimentStatus,
  Variant,
  Allocation,
  TargetingRule,
  PaginatedResponse,
  UpdateVariantsRequest,
} from "@experiments/shared";

const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: HeadersInit = { ...options?.headers };
  if (options?.body) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// --- Environments ---

export function fetchEnvironments(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Environment>> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return request<PaginatedResponse<Environment>>(
    `/environments${qs ? `?${qs}` : ""}`,
  );
}

export function fetchEnvironment(id: string): Promise<Environment> {
  return request<Environment>(`/environments/${id}`);
}

export function createEnvironment(name: string): Promise<Environment> {
  return request<Environment>("/environments", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// --- Experiments ---

export function fetchExperiments(params?: {
  environmentId?: string;
  status?: ExperimentStatus;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Experiment>> {
  const query = new URLSearchParams();
  if (params?.environmentId) query.set("environmentId", params.environmentId);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return request<PaginatedResponse<Experiment>>(
    `/experiments${qs ? `?${qs}` : ""}`,
  );
}

export function fetchExperiment(id: string): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}`);
}

export function createExperiment(data: {
  key: string;
  name: string;
  description?: string;
  environmentId: string;
  audienceId?: string;
  targetingRules?: TargetingRule[];
}): Promise<Experiment> {
  return request<Experiment>("/experiments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateExperiment(
  id: string,
  data: {
    name?: string;
    description?: string;
    audienceId?: string | null;
    targetingRules?: TargetingRule[];
  },
): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function publishExperiment(id: string): Promise<unknown> {
  return request(`/experiments/${id}/publish`, { method: "POST" });
}

export function deleteExperiment(id: string): Promise<Experiment> {
  return request<Experiment>(`/experiments/${id}`, { method: "DELETE" });
}

// --- Variants ---

export function createVariant(
  experimentId: string,
  data: { key: string; name: string; payload?: Record<string, unknown> },
): Promise<Variant> {
  return request<Variant>(`/experiments/${experimentId}/variants`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateVariant(
  experimentId: string,
  variantId: string,
  data: { name?: string; payload?: Record<string, unknown> | null },
): Promise<Variant> {
  return request<Variant>(`/experiments/${experimentId}/variants/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteVariant(
  experimentId: string,
  variantId: string,
): Promise<Variant> {
  return request<Variant>(`/experiments/${experimentId}/variants/${variantId}`, {
    method: "DELETE",
  });
}

export function updateVariants(
  experimentId: string,
  data: UpdateVariantsRequest,
): Promise<Variant[]> {
  return request<Variant[]>(`/experiments/${experimentId}/variants`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// --- Allocations ---

export function setAllocations(
  experimentId: string,
  allocations: Array<{ variantId: string; rangeStart: number; rangeEnd: number }>,
): Promise<Allocation[]> {
  return request<Allocation[]>(`/experiments/${experimentId}/allocations`, {
    method: "PUT",
    body: JSON.stringify({ allocations }),
  });
}

// --- Audiences ---

export function fetchAudiences(params?: {
  environmentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Audience>> {
  const query = new URLSearchParams();
  if (params?.environmentId) query.set("environmentId", params.environmentId);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return request<PaginatedResponse<Audience>>(
    `/audiences${qs ? `?${qs}` : ""}`,
  );
}

export function createAudience(data: {
  name: string;
  environmentId: string;
  rules: TargetingRule[];
}): Promise<Audience> {
  return request<Audience>("/audiences", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAudience(
  id: string,
  data: { name?: string; rules?: TargetingRule[] },
): Promise<Audience> {
  return request<Audience>(`/audiences/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteAudience(id: string): Promise<Audience> {
  return request<Audience>(`/audiences/${id}`, { method: "DELETE" });
}
