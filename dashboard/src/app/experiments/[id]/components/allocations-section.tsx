import { useState } from "react";
import type { Experiment } from "@experiments/shared";
import { setAllocations, fetchExperiment } from "@/lib/api";
import { allocationPercent } from "@/lib/utils";
import { Button } from "@/components/button";
import { ErrorAlert } from "@/components/error-alert";

interface AllocationsSectionProps {
  experiment: Experiment;
  isArchived: boolean;
  onUpdated: (experiment: Experiment) => void;
}

export function AllocationsSection({ experiment, isArchived, onUpdated }: AllocationsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Array<{ variantId: string; percentage: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(
      experiment.variants.map((v) => {
        const alloc = experiment.allocations.find((a) => a.variantId === v.id);
        const pct = alloc
          ? Number(((alloc.rangeEnd - alloc.rangeStart + 1) / 100).toFixed(1))
          : 0;
        return { variantId: v.id, percentage: pct };
      }),
    );
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  function updatePct(variantId: string, pct: number) {
    setDraft((prev) =>
      prev.map((a) => (a.variantId === variantId ? { ...a, percentage: pct } : a)),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      let cursor = 0;
      const allocations = draft
        .filter((a) => a.percentage > 0)
        .map((a) => {
          const buckets = Math.round(a.percentage * 100);
          const rangeStart = cursor;
          const rangeEnd = cursor + buckets - 1;
          cursor = rangeEnd + 1;
          return { variantId: a.variantId, rangeStart, rangeEnd };
        });
      await setAllocations(experiment.id, allocations);
      const updated = await fetchExperiment(experiment.id);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save allocations");
    } finally {
      setSaving(false);
    }
  }

  if (experiment.variants.length === 0) return null;

  const totalPct = draft.reduce((sum, a) => sum + a.percentage, 0);

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900">Traffic allocation</h2>
        {!isArchived && (
          <Button variant="ghost" size="xs" onClick={editing ? cancelEdit : startEdit}>
            {editing ? "Cancel" : "Edit allocation"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
          <div className="space-y-3">
            {draft.map((a) => {
              const variant = experiment.variants.find((v) => v.id === a.variantId);
              return (
                <div key={a.variantId} className="flex items-center gap-3">
                  <span className="w-32 text-sm font-medium text-zinc-700">{variant?.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={a.percentage}
                    onChange={(e) => updatePct(a.variantId, parseFloat(e.target.value) || 0)}
                    className="w-24 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500"
                  />
                  <span className="text-sm text-zinc-500">%</span>
                </div>
              );
            })}
          </div>
          <ErrorAlert message={error} className="mt-3" />
          <div className="mt-4 flex items-center justify-between">
            <p className={`text-xs ${totalPct > 100 ? "text-red-600" : "text-zinc-500"}`}>
              Total: {totalPct.toFixed(1)}%
              {totalPct > 100 && " (exceeds 100%)"}
            </p>
            <Button
              size="sm"
              onClick={save}
              disabled={totalPct > 100}
              loading={saving}
              loadingText="Saving..."
            >
              Save allocation
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          {experiment.allocations.length > 0 && (
            <div className="flex h-3 overflow-hidden bg-zinc-100">
              {experiment.allocations.map((alloc, i) => {
                const pct = (alloc.rangeEnd - alloc.rangeStart + 1) / 100;
                const colors = [
                  "bg-zinc-800",
                  "bg-zinc-500",
                  "bg-zinc-300",
                  "bg-emerald-500",
                  "bg-amber-400",
                ];
                return (
                  <div
                    key={alloc.id}
                    className={colors[i % colors.length]}
                    style={{ width: `${pct}%` }}
                    title={`${pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          )}
          <div className="px-4 py-3">
            {experiment.allocations.length > 0 ? (
              <div className="flex flex-wrap gap-4">
                {experiment.allocations.map((alloc, i) => {
                  const variant = experiment.variants.find((v) => v.id === alloc.variantId);
                  const colors = [
                    "bg-zinc-800",
                    "bg-zinc-500",
                    "bg-zinc-300",
                    "bg-emerald-500",
                    "bg-amber-400",
                  ];
                  return (
                    <div key={alloc.id} className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-sm ${colors[i % colors.length]}`}
                      />
                      <span className="text-sm text-zinc-700">{variant?.name}</span>
                      <span className="text-sm font-medium text-zinc-900">
                        {allocationPercent(alloc.rangeStart, alloc.rangeEnd)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No allocation set. Edit allocation to distribute traffic.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
