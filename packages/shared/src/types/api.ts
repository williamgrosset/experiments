import type { ExperimentStatus, TargetingRule } from "./experiment.js";

// --- Experiment Service API ---

export interface CreateExperimentRequest {
  key: string;
  name: string;
  description?: string;
  environmentId: string;
}

export interface UpdateExperimentRequest {
  name?: string;
  description?: string;
  targetingRules?: TargetingRule[];
}

export interface UpdateExperimentStatusRequest {
  status: ExperimentStatus;
}

export interface CreateVariantRequest {
  key: string;
  name: string;
  payload?: Record<string, unknown>;
}

export interface SetAllocationsRequest {
  allocations: Array<{
    variantId: string;
    rangeStart: number;
    rangeEnd: number;
  }>;
}

export interface CreateEnvironmentRequest {
  name: string;
}

export interface PublishConfigRequest {
  environmentId: string;
}

// --- Decision Service API ---

export interface DecideRequest {
  user_key: string;
  env: string;
  context?: Record<string, unknown>;
}

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
