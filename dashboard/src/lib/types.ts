// Mirrors @experiments/shared types for the dashboard (no workspace dep needed)

export type ExperimentStatus = "DRAFT" | "RUNNING" | "PAUSED" | "ARCHIVED";

export interface Variant {
  id: string;
  key: string;
  name: string;
  payload?: Record<string, unknown>;
}

export interface Allocation {
  id: string;
  variantId: string;
  rangeStart: number;
  rangeEnd: number;
}

export type RuleOperator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "contains"
  | "gt"
  | "lt";

export interface TargetingCondition {
  attribute: string;
  operator: RuleOperator;
  value: unknown;
}

export interface TargetingRule {
  conditions: TargetingCondition[];
}

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
  description?: string;
  salt: string;
  status: ExperimentStatus;
  environmentId: string;
  environment?: Environment;
  variants: Variant[];
  allocations: Allocation[];
  targetingRules: TargetingRule[];
  createdAt: string;
  updatedAt: string;
}
