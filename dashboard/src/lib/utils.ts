import type { ExperimentStatus } from "@experiments/shared";

export function statusColor(status: ExperimentStatus): string {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-700";
    case "RUNNING":
      return "bg-emerald-50 text-emerald-700";
    case "PAUSED":
      return "bg-amber-50 text-amber-700";
    case "ARCHIVED":
      return "bg-red-50 text-red-600";
  }
}

export function statusDot(status: ExperimentStatus): string {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-400";
    case "RUNNING":
      return "bg-emerald-500";
    case "PAUSED":
      return "bg-amber-500";
    case "ARCHIVED":
      return "bg-red-400";
  }
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function allocationPercent(rangeStart: number, rangeEnd: number): string {
  const pct = ((rangeEnd - rangeStart + 1) / 100).toFixed(1);
  return `${pct}%`;
}
