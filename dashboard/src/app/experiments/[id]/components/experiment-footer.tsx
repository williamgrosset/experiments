import type { Experiment } from "@experiments/shared";
import { formatDateTime } from "@/lib/utils";

interface ExperimentFooterProps {
  experiment: Experiment;
}

export function ExperimentFooter({ experiment }: ExperimentFooterProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/30 px-4 py-3">
      <div className="flex items-center gap-6 text-xs text-zinc-400">
        <span>
          ID: <span className="font-mono text-zinc-500">{experiment.id}</span>
        </span>
        <span>
          Salt: <span className="font-mono text-zinc-500">{experiment.salt}</span>
        </span>
        <span>Updated: {formatDateTime(experiment.updatedAt)}</span>
      </div>
    </div>
  );
}
