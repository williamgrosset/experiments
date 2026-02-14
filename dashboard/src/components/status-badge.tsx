import { statusColor, statusDot } from "@/lib/utils";
import type { ExperimentStatus } from "@experiments/shared";

interface StatusBadgeProps {
  status: ExperimentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(status)}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot(status)}`}
      />
      {status}
    </span>
  );
}
