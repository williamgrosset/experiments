"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchExperiment,
  updateExperiment,
  updateExperimentStatus,
  publishExperiment,
  deleteExperiment,
  createVariant,
  setAllocations,
} from "@/lib/api";
import {
  statusColor,
  statusDot,
  formatDateTime,
  allocationPercent,
} from "@/lib/utils";
import type { Experiment, ExperimentStatus } from "@/lib/types";

const STATUS_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  DRAFT: ["RUNNING", "ARCHIVED"],
  RUNNING: ["PAUSED", "ARCHIVED"],
  PAUSED: ["RUNNING", "ARCHIVED"],
  ARCHIVED: [],
};

const STATUS_ACTION_STYLES: Record<string, string> = {
  RUNNING: "bg-emerald-600 text-white hover:bg-emerald-700",
  PAUSED: "bg-amber-500 text-white hover:bg-amber-600",
  ARCHIVED: "bg-red-500 text-white hover:bg-red-600",
};

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Variant creation
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantKey, setVariantKey] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantPayload, setVariantPayload] = useState("");
  const [payloadError, setPayloadError] = useState("");
  const [addingVariant, setAddingVariant] = useState(false);

  // Allocation editing
  const [editingAllocs, setEditingAllocs] = useState(false);
  const [allocDraft, setAllocDraft] = useState<
    Array<{ variantId: string; percentage: number }>
  >([]);
  const [savingAllocs, setSavingAllocs] = useState(false);

  // Publishing
  const [publishing, setPublishing] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchExperiment(id)
      .then((exp) => {
        setExperiment(exp);
        setEditName(exp.name);
        setEditDesc(exp.description || "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!experiment) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateExperiment(experiment.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      setExperiment(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: ExperimentStatus) {
    if (!experiment) return;
    setError("");
    try {
      const updated = await updateExperimentStatus(experiment.id, status);
      setExperiment(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handlePublish() {
    if (!experiment) return;
    setPublishing(true);
    setError("");
    try {
      await publishExperiment(experiment.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!experiment) return;
    setDeleting(true);
    setError("");
    try {
      await deleteExperiment(experiment.id);
      router.push("/experiments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!experiment) return;

    let parsedPayload: Record<string, unknown> | undefined;
    if (variantPayload.trim()) {
      try {
        parsedPayload = JSON.parse(variantPayload.trim());
        if (typeof parsedPayload !== "object" || Array.isArray(parsedPayload) || parsedPayload === null) {
          setPayloadError("Payload must be a JSON object");
          return;
        }
      } catch {
        setPayloadError("Invalid JSON");
        return;
      }
    }

    setAddingVariant(true);
    setError("");
    try {
      await createVariant(experiment.id, {
        key: variantKey.trim(),
        name: variantName.trim(),
        ...(parsedPayload !== undefined && { payload: parsedPayload }),
      });
      setVariantKey("");
      setVariantName("");
      setVariantPayload("");
      setPayloadError("");
      setShowVariantForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add variant");
    } finally {
      setAddingVariant(false);
    }
  }

  function startAllocEdit() {
    if (!experiment) return;
    const draft = experiment.variants.map((v) => {
      const alloc = experiment.allocations.find((a) => a.variantId === v.id);
      const pct = alloc
        ? Number(((alloc.rangeEnd - alloc.rangeStart + 1) / 100).toFixed(1))
        : 0;
      return { variantId: v.id, percentage: pct };
    });
    setAllocDraft(draft);
    setEditingAllocs(true);
  }

  function updateAllocPct(variantId: string, pct: number) {
    setAllocDraft((prev) =>
      prev.map((a) => (a.variantId === variantId ? { ...a, percentage: pct } : a)),
    );
  }

  async function handleSaveAllocs() {
    if (!experiment) return;
    setSavingAllocs(true);
    setError("");
    try {
      let cursor = 0;
      const allocations = allocDraft
        .filter((a) => a.percentage > 0)
        .map((a) => {
          const buckets = Math.round(a.percentage * 100);
          const rangeStart = cursor;
          const rangeEnd = cursor + buckets - 1;
          cursor = rangeEnd + 1;
          return { variantId: a.variantId, rangeStart, rangeEnd };
        });
      await setAllocations(experiment.id, allocations);
      setEditingAllocs(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save allocations");
    } finally {
      setSavingAllocs(false);
    }
  }

  const totalAllocPct = allocDraft.reduce((sum, a) => sum + a.percentage, 0);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-500">Experiment not found.</p>
        <Link href="/experiments" className="text-sm text-zinc-900 underline">
          Back to experiments
        </Link>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[experiment.status];

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400">
        <Link href="/experiments" className="hover:text-zinc-700">
          Experiments
        </Link>
        <span>/</span>
        <span className="text-zinc-700">{experiment.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-semibold outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Description..."
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight">
                  {experiment.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(experiment.status)}`}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot(experiment.status)}`}
                  />
                  {experiment.status}
                </span>
              </div>
              {experiment.description && (
                <p className="mt-1 text-sm text-zinc-500">
                  {experiment.description}
                </p>
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-2 text-xs text-zinc-400 hover:text-zinc-700"
              >
                Edit details
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-6 flex items-center gap-2">
          {transitions.map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${STATUS_ACTION_STYLES[s] || "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              {s === "RUNNING" ? "Start" : s === "PAUSED" ? "Pause" : "Archive"}
            </button>
          ))}
          {(experiment.status === "RUNNING" || experiment.status === "PAUSED") && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              {publishing ? "Publishing..." : "Publish config"}
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-zinc-900">
              Delete experiment
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              Are you sure you want to delete{" "}
              <span className="font-medium text-zinc-700">
                {experiment.name}
              </span>
              ? This will permanently remove the experiment, its variants, and
              allocations. The environment config will be re-published to
              reflect this change.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "Key", value: experiment.key, mono: true },
          { label: "Environment", value: experiment.environment?.name ?? experiment.environmentId },
          { label: "Created", value: formatDateTime(experiment.createdAt) },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-zinc-200 px-4 py-3"
          >
            <p className="text-xs font-medium text-zinc-500">{m.label}</p>
            <p
              className={`mt-0.5 text-sm ${m.mono ? "font-mono" : ""} text-zinc-900`}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Variants */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Variants</h2>
          {experiment.status !== "ARCHIVED" && (
            <button
              onClick={() => setShowVariantForm(!showVariantForm)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              {showVariantForm ? "Cancel" : "+ Add variant"}
            </button>
          )}
        </div>

        {showVariantForm && (
          <form
            onSubmit={handleAddVariant}
            className="mb-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-600">
                  Key
                </label>
                <input
                  type="text"
                  value={variantKey}
                  onChange={(e) => setVariantKey(e.target.value)}
                  placeholder="e.g. control"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-600">
                  Name
                </label>
                <input
                  type="text"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g. Control"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600">
                Payload <span className="font-normal text-zinc-400">(optional JSON)</span>
              </label>
              <textarea
                value={variantPayload}
                onChange={(e) => {
                  setVariantPayload(e.target.value);
                  setPayloadError("");
                }}
                placeholder='{"color": "blue", "buttonText": "Sign up now"}'
                rows={3}
                className={`mt-1 w-full rounded-md border px-2.5 py-1.5 font-mono text-sm outline-none focus:border-zinc-500 ${payloadError ? "border-red-300 bg-red-50/50" : "border-zinc-300"}`}
              />
              {payloadError && (
                <p className="mt-1 text-xs text-red-600">{payloadError}</p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingVariant}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {addingVariant ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60">
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">
                  Name
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">
                  Key
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">
                  Payload
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">
                  Allocation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {experiment.variants.map((v) => {
                const alloc = experiment.allocations.find(
                  (a) => a.variantId === v.id,
                );
                return (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {v.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {v.key}
                    </td>
                    <td className="px-4 py-3">
                      {v.payload ? (
                        <code className="inline-block max-w-xs truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
                          {JSON.stringify(v.payload)}
                        </code>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {alloc
                        ? allocationPercent(alloc.rangeStart, alloc.rangeEnd)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {experiment.variants.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-sm text-zinc-400"
                  >
                    No variants yet. Add at least two to run this experiment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocations */}
      {experiment.variants.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-900">
              Traffic allocation
            </h2>
            {experiment.status !== "ARCHIVED" && (
              <button
                onClick={() =>
                  editingAllocs ? setEditingAllocs(false) : startAllocEdit()
                }
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                {editingAllocs ? "Cancel" : "Edit allocation"}
              </button>
            )}
          </div>

          {editingAllocs ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="space-y-3">
                {allocDraft.map((a) => {
                  const variant = experiment.variants.find(
                    (v) => v.id === a.variantId,
                  );
                  return (
                    <div key={a.variantId} className="flex items-center gap-3">
                      <span className="w-32 text-sm font-medium text-zinc-700">
                        {variant?.name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={a.percentage}
                        onChange={(e) =>
                          updateAllocPct(a.variantId, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500"
                      />
                      <span className="text-sm text-zinc-500">%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p
                  className={`text-xs ${totalAllocPct > 100 ? "text-red-600" : "text-zinc-500"}`}
                >
                  Total: {totalAllocPct.toFixed(1)}%
                  {totalAllocPct > 100 && " (exceeds 100%)"}
                </p>
                <button
                  onClick={handleSaveAllocs}
                  disabled={savingAllocs || totalAllocPct > 100}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingAllocs ? "Saving..." : "Save allocation"}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              {/* Visual allocation bar */}
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
                        className={`${colors[i % colors.length]}`}
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
                      const variant = experiment.variants.find(
                        (v) => v.id === alloc.variantId,
                      );
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
                          <span className="text-sm text-zinc-700">
                            {variant?.name}
                          </span>
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
      )}

      {/* Salt & ID */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/30 px-4 py-3">
        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <span>
            ID:{" "}
            <span className="font-mono text-zinc-500">{experiment.id}</span>
          </span>
          <span>
            Salt:{" "}
            <span className="font-mono text-zinc-500">{experiment.salt}</span>
          </span>
          <span>
            Updated: {formatDateTime(experiment.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
