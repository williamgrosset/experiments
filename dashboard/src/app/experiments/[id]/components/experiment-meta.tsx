import type { Experiment } from "@experiments/shared";
import { formatDateTime } from "@/lib/utils";
import { StatCard } from "@/components/stat-card";

interface ExperimentMetaProps {
  experiment: Experiment;
}

export function ExperimentMeta({ experiment }: ExperimentMetaProps) {
  return (
    <div className="mb-8 grid grid-cols-3 gap-4">
      <StatCard label="Key" value={experiment.key} mono size="sm" />
      <StatCard
        label="Environment"
        value={experiment.environment?.name ?? experiment.environmentId}
        size="sm"
      />
      <StatCard label="Created" value={formatDateTime(experiment.createdAt)} size="sm" />
    </div>
  );
}
