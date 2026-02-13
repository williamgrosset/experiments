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
  rangeStart: number; // 0–9999
  rangeEnd: number; // 0–9999
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
  conditions: TargetingCondition[]; // AND within a rule
}

export interface Experiment {
  id: string;
  key: string;
  name: string;
  description?: string;
  salt: string;
  status: ExperimentStatus;
  environmentId: string;
  variants: Variant[];
  allocations: Allocation[];
  targetingRules: TargetingRule[];
}

export interface ConfigSnapshot {
  version: number;
  environment: string;
  publishedAt: string; // ISO 8601
  experiments: ConfigExperiment[];
}

export interface ConfigExperiment {
  id: string;
  key: string;
  salt: string;
  targetingRules: TargetingRule[];
  variants: Pick<Variant, "id" | "key" | "payload">[];
  allocations: Pick<Allocation, "variantId" | "rangeStart" | "rangeEnd">[];
}
