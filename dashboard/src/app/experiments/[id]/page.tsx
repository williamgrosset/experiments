"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchExperiment,
  fetchAudiences,
  updateExperiment,
  updateExperimentStatus,
  publishExperiment,
  deleteExperiment,
  createVariant,
  updateVariant,
  deleteVariant,
  setAllocations,
} from "@/lib/api";
import { formatDateTime, allocationPercent } from "@/lib/utils";
import type {
  Experiment,
  ExperimentStatus,
  Audience,
  Variant,
  TargetingRule,
  TargetingCondition,
  RuleOperator,
} from "@experiments/shared";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer } from "@/components/page-layout";
import { Input, Textarea, Select, FormField } from "@/components/form";
import { ErrorAlert } from "@/components/error-alert";
import { StatCard } from "@/components/stat-card";

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in list" },
  { value: "notIn", label: "not in list" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
];

function emptyCondition(): TargetingCondition {
  return { attribute: "", operator: "eq", value: "" };
}

function emptyRule(): TargetingRule {
  return { conditions: [emptyCondition()] };
}

function parseConditionValue(operator: RuleOperator, raw: string): unknown {
  if (operator === "in" || operator === "notIn") {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (operator === "gt" || operator === "lt") {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

function serializeConditionValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

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

// Draft type for variant editing
type VariantDraft = {
  id: string;
  key: string;
  name: string;
  payloadRaw: string;
  payloadError: string;
};

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Details edit
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Audience edit
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [editingAudience, setEditingAudience] = useState(false);
  const [audienceDraft, setAudienceDraft] = useState("");
  const [savingAudience, setSavingAudience] = useState(false);

  // Targeting rules edit
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<TargetingRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);

  // Variants edit
  const [editingVariants, setEditingVariants] = useState(false);
  const [variantsDraft, setVariantsDraft] = useState<VariantDraft[]>([]);
  const [savingVariants, setSavingVariants] = useState(false);
  // New variant form (inline within edit mode)
  const [newVariantKey, setNewVariantKey] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPayload, setNewVariantPayload] = useState("");
  const [newVariantPayloadError, setNewVariantPayloadError] = useState("");
  const [addingVariant, setAddingVariant] = useState(false);

  // Allocation editing
  const [editingAllocs, setEditingAllocs] = useState(false);
  const [allocDraft, setAllocDraft] = useState<
    Array<{ variantId: string; percentage: number }>
  >([]);
  const [savingAllocs, setSavingAllocs] = useState(false);

  // Status change
  const [statusChanging, setStatusChanging] = useState<ExperimentStatus | null>(null);

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
        return fetchAudiences({ environmentId: exp.environmentId, page: 1, pageSize: 100 });
      })
      .then((res) => {
        setAudiences(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Details ---

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

  // --- Audience ---

  function startEditAudience() {
    if (!experiment) return;
    setAudienceDraft(experiment.audienceId ?? "");
    setEditingAudience(true);
  }

  function cancelEditAudience() {
    setEditingAudience(false);
  }

  async function handleSaveAudience() {
    if (!experiment) return;
    setSavingAudience(true);
    setError("");
    try {
      const updated = await updateExperiment(experiment.id, {
        audienceId: audienceDraft || null,
      });
      setExperiment(updated);
      setEditingAudience(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save audience");
    } finally {
      setSavingAudience(false);
    }
  }

  // --- Targeting rules ---

  function startEditRules() {
    if (!experiment) return;
    const rules = experiment.targetingRules ?? [];
    setRulesDraft(rules.length > 0 ? JSON.parse(JSON.stringify(rules)) : []);
    setEditingRules(true);
  }

  function cancelEditRules() {
    setEditingRules(false);
  }

  function addRule() {
    setRulesDraft([...rulesDraft, emptyRule()]);
  }

  function removeRule(ruleIndex: number) {
    setRulesDraft(rulesDraft.filter((_, i) => i !== ruleIndex));
  }

  function addCondition(ruleIndex: number) {
    setRulesDraft(
      rulesDraft.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: [...rule.conditions, emptyCondition()] }
          : rule,
      ),
    );
  }

  function removeCondition(ruleIndex: number, condIndex: number) {
    setRulesDraft(
      rulesDraft.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: rule.conditions.filter((_, j) => j !== condIndex) }
          : rule,
      ),
    );
  }

  function updateCondition(
    ruleIndex: number,
    condIndex: number,
    field: keyof TargetingCondition,
    value: string,
  ) {
    setRulesDraft(
      rulesDraft.map((rule, ri) =>
        ri === ruleIndex
          ? {
              ...rule,
              conditions: rule.conditions.map((cond, ci) => {
                if (ci !== condIndex) return cond;
                if (field === "operator") return { ...cond, operator: value as RuleOperator };
                if (field === "attribute") return { ...cond, attribute: value };
                return { ...cond, value };
              }),
            }
          : rule,
      ),
    );
  }

  function buildRulesPayload(draft: TargetingRule[]): TargetingRule[] | undefined {
    if (draft.length === 0) return undefined;
    const cleaned = draft
      .map((rule) => ({
        conditions: rule.conditions
          .filter(
            (c) =>
              c.attribute.trim() !== "" &&
              serializeConditionValue(c.value).trim() !== "",
          )
          .map((c) => ({
            ...c,
            value: parseConditionValue(c.operator, serializeConditionValue(c.value)),
          })),
      }))
      .filter((rule) => rule.conditions.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  async function handleSaveRules() {
    if (!experiment) return;
    setSavingRules(true);
    setError("");
    try {
      const updated = await updateExperiment(experiment.id, {
        targetingRules: buildRulesPayload(rulesDraft) ?? [],
      });
      setExperiment(updated);
      setEditingRules(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targeting rules");
    } finally {
      setSavingRules(false);
    }
  }

  // --- Variants ---

  function variantTooDraft(v: Variant): VariantDraft {
    return {
      id: v.id,
      key: v.key,
      name: v.name,
      payloadRaw: v.payload ? JSON.stringify(v.payload, null, 2) : "",
      payloadError: "",
    };
  }

  function startEditVariants() {
    if (!experiment) return;
    setVariantsDraft(experiment.variants.map(variantTooDraft));
    setNewVariantKey("");
    setNewVariantName("");
    setNewVariantPayload("");
    setNewVariantPayloadError("");
    setEditingVariants(true);
  }

  function cancelEditVariants() {
    setEditingVariants(false);
  }

  function updateDraftVariant(id: string, field: "name" | "payloadRaw", value: string) {
    setVariantsDraft((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, [field]: value, payloadError: field === "payloadRaw" ? "" : v.payloadError }
          : v,
      ),
    );
  }

  function removeDraftVariant(id: string) {
    setVariantsDraft((prev) => prev.filter((v) => v.id !== id));
  }

  async function handleAddVariantInEdit() {
    if (!experiment) return;

    let parsedPayload: Record<string, unknown> | undefined;
    if (newVariantPayload.trim()) {
      try {
        parsedPayload = JSON.parse(newVariantPayload.trim());
        if (
          typeof parsedPayload !== "object" ||
          Array.isArray(parsedPayload) ||
          parsedPayload === null
        ) {
          setNewVariantPayloadError("Payload must be a JSON object");
          return;
        }
      } catch {
        setNewVariantPayloadError("Invalid JSON");
        return;
      }
    }

    setAddingVariant(true);
    setError("");
    try {
      const created = await createVariant(experiment.id, {
        key: newVariantKey.trim(),
        name: newVariantName.trim(),
        ...(parsedPayload !== undefined && { payload: parsedPayload }),
      });
      setVariantsDraft((prev) => [...prev, variantTooDraft(created)]);
      setNewVariantKey("");
      setNewVariantName("");
      setNewVariantPayload("");
      setNewVariantPayloadError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add variant");
    } finally {
      setAddingVariant(false);
    }
  }

  async function handleSaveVariants() {
    if (!experiment) return;

    // Validate payloads before sending
    let hasError = false;
    setVariantsDraft((prev) =>
      prev.map((v) => {
        if (!v.payloadRaw.trim()) return { ...v, payloadError: "" };
        try {
          const parsed = JSON.parse(v.payloadRaw.trim());
          if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
            hasError = true;
            return { ...v, payloadError: "Must be a JSON object" };
          }
          return { ...v, payloadError: "" };
        } catch {
          hasError = true;
          return { ...v, payloadError: "Invalid JSON" };
        }
      }),
    );
    if (hasError) return;

    setSavingVariants(true);
    setError("");
    try {
      const original = experiment.variants;
      const deletedIds = original
        .filter((v) => !variantsDraft.some((d) => d.id === v.id))
        .map((v) => v.id);

      await Promise.all([
        // Delete removed variants
        ...deletedIds.map((vid) => deleteVariant(experiment.id, vid)),
        // Update changed variants
        ...variantsDraft.map((draft) => {
          const orig = original.find((v) => v.id === draft.id);
          if (!orig) return Promise.resolve(); // newly added — already created
          const payload = draft.payloadRaw.trim()
            ? (JSON.parse(draft.payloadRaw.trim()) as Record<string, unknown>)
            : null;
          return updateVariant(experiment.id, draft.id, {
            name: draft.name.trim(),
            payload,
          });
        }),
      ]);

      setEditingVariants(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save variants");
    } finally {
      setSavingVariants(false);
    }
  }

  // --- Status / publish / delete ---

  async function handleStatusChange(status: ExperimentStatus) {
    if (!experiment) return;
    setError("");
    setStatusChanging(status);
    try {
      const updated = await updateExperimentStatus(experiment.id, status);
      setExperiment(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusChanging(null);
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

  // --- Allocations ---

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
    return <Spinner />;
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
  const isArchived = experiment.status === "ARCHIVED";

  const variantColumns: Column<(typeof experiment.variants)[number]>[] = [
    {
      key: "name",
      header: "Name",
      className: "px-4 py-3 font-medium text-zinc-900",
      render: (v) => v.name,
    },
    {
      key: "key",
      header: "Key",
      className: "px-4 py-3 font-mono text-xs text-zinc-500",
      render: (v) => v.key,
    },
    {
      key: "payload",
      header: "Payload",
      render: (v) =>
        v.payload ? (
          <code className="inline-block max-w-xs truncate rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
            {JSON.stringify(v.payload)}
          </code>
        ) : (
          <span className="text-zinc-400">{"\u2014"}</span>
        ),
    },
    {
      key: "allocation",
      header: "Allocation",
      className: "px-4 py-3 text-zinc-500",
      render: (v) => {
        const alloc = experiment.allocations.find((a) => a.variantId === v.id);
        return alloc
          ? allocationPercent(alloc.rangeStart, alloc.rangeEnd)
          : "\u2014";
      },
    },
  ];

  // Audience display name
  const currentAudience = experiment.audienceId
    ? audiences.find((a) => a.id === experiment.audienceId)
    : null;

  // Rules summary for read-only display
  const targetingRules = experiment.targetingRules ?? [];
  const rulesCount = targetingRules.length;
  const conditionsCount = targetingRules.reduce(
    (sum, r) => sum + r.conditions.length,
    0,
  );

  return (
    <PageContainer maxWidth="4xl">
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
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-semibold"
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Description..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} loading={saving} loadingText="Saving...">
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight">{experiment.name}</h1>
                <StatusBadge status={experiment.status} />
              </div>
              {experiment.description && (
                <p className="mt-1 text-sm text-zinc-500">{experiment.description}</p>
              )}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setEditing(true)}
                className="mt-2 text-zinc-400 hover:text-zinc-700"
              >
                Edit details
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-6 flex items-center gap-2">
          {transitions.map((s) => (
            <Button
              key={s}
              size="sm"
              onClick={() => handleStatusChange(s)}
              loading={statusChanging === s}
              disabled={statusChanging !== null}
              className={`text-xs ${STATUS_ACTION_STYLES[s] || "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              {s === "RUNNING" ? "Start" : s === "PAUSED" ? "Pause" : "Archive"}
            </Button>
          ))}
          {(experiment.status === "RUNNING" || experiment.status === "PAUSED") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePublish}
              loading={publishing}
              loadingText="Publishing..."
              className="text-xs"
            >
              Publish config
            </Button>
          )}
          <Button
            variant="danger-outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs"
          >
            Delete
          </Button>
        </div>
      </div>

      <ErrorAlert message={error} className="mb-6" />

      {/* Delete confirmation dialog */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete experiment"
        maxWidth="max-w-sm"
      >
        <p className="mt-2 text-sm text-zinc-500">
          Are you sure you want to delete{" "}
          <span className="font-medium text-zinc-700">{experiment.name}</span>? This will
          permanently remove the experiment, its variants, and allocations. The environment config
          will be re-published to reflect this change.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            loadingText="Deleting..."
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Metadata */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <StatCard label="Key" value={experiment.key} mono size="sm" />
        <StatCard
          label="Environment"
          value={experiment.environment?.name ?? experiment.environmentId}
          size="sm"
        />
        <StatCard label="Created" value={formatDateTime(experiment.createdAt)} size="sm" />
      </div>

      {/* Audience */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Audience</h2>
          {!isArchived && !editingAudience && (
            <Button variant="ghost" size="xs" onClick={startEditAudience}>
              Edit audience
            </Button>
          )}
        </div>

        {editingAudience ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
            <FormField
              label="Audience"
              optional
              hint="Pick a reusable audience for this experiment, or leave empty for no audience filter."
            >
              <Select value={audienceDraft} onChange={(e) => setAudienceDraft(e.target.value)}>
                <option value="">No audience</option>
                {audiences.map((audience) => (
                  <option key={audience.id} value={audience.id}>
                    {audience.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelEditAudience}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAudience}
                loading={savingAudience}
                loadingText="Saving..."
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 px-4 py-3">
            <p className="text-sm text-zinc-700">
              {currentAudience ? (
                currentAudience.name
              ) : (
                <span className="text-zinc-400">No audience — all users are eligible.</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Targeting rules */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Targeting rules</h2>
          {!isArchived && !editingRules && (
            <Button variant="ghost" size="xs" onClick={startEditRules}>
              Edit rules
            </Button>
          )}
        </div>

        {editingRules ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700">
                Rules
                <span className="ml-1 font-normal text-zinc-400">(optional)</span>
              </label>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={addRule}
                className="text-zinc-600"
              >
                + Add rule
              </Button>
            </div>

            {rulesDraft.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No targeting rules. All users will be eligible.
              </p>
            ) : (
              <div className="space-y-3">
                {rulesDraft.map((rule, ruleIndex) => (
                  <div
                    key={ruleIndex}
                    className="rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Rule {ruleIndex + 1}
                        {rulesDraft.length > 1 && ruleIndex < rulesDraft.length - 1 && (
                          <span className="ml-1.5 font-normal normal-case text-zinc-400">
                            (OR)
                          </span>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        type="button"
                        onClick={() => removeRule(ruleIndex)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {rule.conditions.map((condition, condIndex) => (
                        <div key={condIndex}>
                          {condIndex > 0 && (
                            <div className="my-1.5 flex items-center gap-2">
                              <div className="h-px flex-1 bg-zinc-200" />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                AND
                              </span>
                              <div className="h-px flex-1 bg-zinc-200" />
                            </div>
                          )}
                          <div className="flex items-start gap-2">
                            <Input
                              type="text"
                              placeholder="attribute"
                              value={condition.attribute}
                              onChange={(e) =>
                                updateCondition(ruleIndex, condIndex, "attribute", e.target.value)
                              }
                              size="sm"
                              mono
                              className="w-1/3"
                            />
                            <Select
                              value={condition.operator}
                              onChange={(e) =>
                                updateCondition(ruleIndex, condIndex, "operator", e.target.value)
                              }
                              size="sm"
                              className="w-1/4"
                            >
                              {OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="text"
                              placeholder={
                                condition.operator === "in" || condition.operator === "notIn"
                                  ? "val1, val2, ..."
                                  : "value"
                              }
                              value={serializeConditionValue(condition.value)}
                              onChange={(e) =>
                                updateCondition(ruleIndex, condIndex, "value", e.target.value)
                              }
                              size="sm"
                              className="w-1/2"
                            />
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              onClick={() => removeCondition(ruleIndex, condIndex)}
                              disabled={rule.conditions.length === 1}
                              className="rounded-md px-1.5 py-1.5 text-zinc-400 hover:text-red-600 disabled:hover:text-zinc-400"
                              title="Remove condition"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      onClick={() => addCondition(ruleIndex)}
                      className="mt-2.5 hover:text-zinc-700"
                    >
                      + Add condition
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {rulesDraft.length > 0 && (
              <p className="mt-2 text-xs text-zinc-400">
                Users matching <span className="font-medium">any</span> rule are eligible. Within a
                rule, <span className="font-medium">all</span> conditions must match.
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelEditRules}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRules}
                loading={savingRules}
                loadingText="Saving..."
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 px-4 py-3">
            {rulesCount > 0 ? (
              <p className="text-sm text-zinc-700">
                {rulesCount} {rulesCount === 1 ? "rule" : "rules"},{" "}
                {conditionsCount} {conditionsCount === 1 ? "condition" : "conditions"}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">No targeting rules — all users are eligible.</p>
            )}
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900">Variants</h2>
          {!isArchived && !editingVariants && (
            <Button variant="ghost" size="xs" onClick={startEditVariants}>
              Edit variants
            </Button>
          )}
        </div>

        {editingVariants ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
            <div className="space-y-3">
              {variantsDraft.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-400">{draft.key}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      onClick={() => removeDraftVariant(draft.id)}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <FormField label="Name" labelSize="xs">
                      <Input
                        type="text"
                        value={draft.name}
                        onChange={(e) => updateDraftVariant(draft.id, "name", e.target.value)}
                        size="sm"
                        required
                      />
                    </FormField>
                    <FormField label="Payload" labelSize="xs" error={draft.payloadError}>
                      <span className="font-normal text-xs text-zinc-400">(optional JSON)</span>
                      <Textarea
                        value={draft.payloadRaw}
                        onChange={(e) => updateDraftVariant(draft.id, "payloadRaw", e.target.value)}
                        placeholder='{"color": "blue"}'
                        rows={2}
                        size="sm"
                        mono
                        className={draft.payloadError ? "border-red-300 bg-red-50/50" : ""}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new variant inline */}
            <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-500">Add variant</p>
              <div className="flex items-end gap-3">
                <FormField label="Key" labelSize="xs" className="flex-1">
                  <Input
                    type="text"
                    value={newVariantKey}
                    onChange={(e) => setNewVariantKey(e.target.value)}
                    placeholder="e.g. control"
                    size="sm"
                  />
                </FormField>
                <FormField label="Name" labelSize="xs" className="flex-1">
                  <Input
                    type="text"
                    value={newVariantName}
                    onChange={(e) => setNewVariantName(e.target.value)}
                    placeholder="e.g. Control"
                    size="sm"
                  />
                </FormField>
              </div>
              <FormField label="Payload" labelSize="xs" error={newVariantPayloadError} className="mt-2">
                <span className="font-normal text-xs text-zinc-400">(optional JSON)</span>
                <Textarea
                  value={newVariantPayload}
                  onChange={(e) => {
                    setNewVariantPayload(e.target.value);
                    setNewVariantPayloadError("");
                  }}
                  placeholder='{"color": "blue"}'
                  rows={2}
                  size="sm"
                  mono
                  className={newVariantPayloadError ? "border-red-300 bg-red-50/50" : ""}
                />
              </FormField>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddVariantInEdit}
                  loading={addingVariant}
                  loadingText="Adding..."
                  disabled={!newVariantKey.trim() || !newVariantName.trim()}
                >
                  + Add
                </Button>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={cancelEditVariants}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveVariants}
                loading={savingVariants}
                loadingText="Saving..."
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <DataTable
            columns={variantColumns}
            data={experiment.variants}
            rowKey={(v) => v.id}
            hoverRows={false}
            emptyMessage="No variants yet. Add at least two to run this experiment."
          />
        )}
      </div>

      {/* Allocations */}
      {experiment.variants.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-900">Traffic allocation</h2>
            {!isArchived && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => (editingAllocs ? setEditingAllocs(false) : startAllocEdit())}
              >
                {editingAllocs ? "Cancel" : "Edit allocation"}
              </Button>
            )}
          </div>

          {editingAllocs ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="space-y-3">
                {allocDraft.map((a) => {
                  const variant = experiment.variants.find((v) => v.id === a.variantId);
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
                <p className={`text-xs ${totalAllocPct > 100 ? "text-red-600" : "text-zinc-500"}`}>
                  Total: {totalAllocPct.toFixed(1)}%
                  {totalAllocPct > 100 && " (exceeds 100%)"}
                </p>
                <Button
                  size="sm"
                  onClick={handleSaveAllocs}
                  disabled={totalAllocPct > 100}
                  loading={savingAllocs}
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
      )}

      {/* Salt & ID */}
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
    </PageContainer>
  );
}
