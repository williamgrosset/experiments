import { useState } from "react";
import type { Experiment, Variant } from "@experiments/shared";
import { fetchExperiment, updateVariants } from "@/lib/api";
import { allocationPercent } from "@/lib/utils";
import { Button } from "@/components/button";
import { DataTable, type Column } from "@/components/data-table";
import { ErrorAlert } from "@/components/error-alert";
import { FormField, Input, Textarea } from "@/components/form";

type VariantDraft = {
  clientId: string;
  id?: string;
  key: string;
  name: string;
  payloadRaw: string;
  payloadError: string;
};

function toVariantDraft(variant: Variant): VariantDraft {
  return {
    clientId: variant.id,
    id: variant.id,
    key: variant.key,
    name: variant.name,
    payloadRaw: variant.payload ? JSON.stringify(variant.payload, null, 2) : "",
    payloadError: "",
  };
}

interface VariantsSectionProps {
  experiment: Experiment;
  isArchived: boolean;
  onUpdated: (experiment: Experiment) => void;
}

export function VariantsSection({ experiment, isArchived, onUpdated }: VariantsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VariantDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newPayload, setNewPayload] = useState("");
  const [newPayloadError, setNewPayloadError] = useState("");

  function startEdit() {
    setDraft(experiment.variants.map(toVariantDraft));
    setNewKey("");
    setNewName("");
    setNewPayload("");
    setNewPayloadError("");
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  function updateDraft(clientId: string, field: "name" | "payloadRaw", value: string) {
    setDraft((prev) =>
      prev.map((v) =>
        v.clientId === clientId
          ? { ...v, [field]: value, payloadError: field === "payloadRaw" ? "" : v.payloadError }
          : v,
      ),
    );
  }

  function removeDraft(clientId: string) {
    setDraft((prev) => prev.filter((v) => v.clientId !== clientId));
  }

  function addVariant() {
    if (newPayload.trim()) {
      try {
        const parsed = JSON.parse(newPayload.trim());
        if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
          setNewPayloadError("Payload must be a JSON object");
          return;
        }
      } catch {
        setNewPayloadError("Invalid JSON");
        return;
      }
    }

    setDraft((prev) => [
      ...prev,
      {
        clientId: crypto.randomUUID(),
        key: newKey.trim(),
        name: newName.trim(),
        payloadRaw: newPayload.trim(),
        payloadError: "",
      },
    ]);
    setNewKey("");
    setNewName("");
    setNewPayload("");
    setNewPayloadError("");
  }

  async function save() {
    let hasError = false;
    setDraft((prev) =>
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

    setSaving(true);
    setError("");
    try {
      const persistedDrafts = draft.filter(
        (d): d is VariantDraft & { id: string } => d.id !== undefined,
      );

      const toDelete = experiment.variants
        .filter((v) => !persistedDrafts.some((d) => d.id === v.id))
        .map((v) => ({ id: v.id }));

      const toUpdate = persistedDrafts.map((d) => ({
        id: d.id,
        name: d.name.trim(),
        payload: d.payloadRaw.trim()
          ? (JSON.parse(d.payloadRaw.trim()) as Record<string, unknown>)
          : null,
      }));

      const toCreate = draft
        .filter((d) => d.id === undefined)
        .map((d) => ({
          key: d.key,
          name: d.name.trim(),
          ...(d.payloadRaw.trim()
            ? { payload: JSON.parse(d.payloadRaw.trim()) as Record<string, unknown> }
            : {}),
        }));

      await updateVariants(experiment.id, {
        create: toCreate,
        update: toUpdate,
        delete: toDelete,
      });

      const updated = await fetchExperiment(experiment.id);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save variants");
    } finally {
      setSaving(false);
    }
  }

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
        return alloc ? allocationPercent(alloc.rangeStart, alloc.rangeEnd) : "\u2014";
      },
    },
  ];

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900">Variants</h2>
        {!isArchived && !editing && (
          <Button variant="ghost" size="xs" onClick={startEdit}>
            Edit variants
          </Button>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
          <div className="space-y-3">
            {draft.map((v) => (
              <div key={v.clientId} className="rounded-lg border border-zinc-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-400">{v.key}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    type="button"
                    onClick={() => removeDraft(v.clientId)}
                    className="text-zinc-400 hover:text-red-600"
                  >
                    Remove
                  </Button>
                </div>
                <div className="space-y-2">
                  <FormField label="Name" labelSize="xs">
                    <Input
                      type="text"
                      value={v.name}
                      onChange={(e) => updateDraft(v.clientId, "name", e.target.value)}
                      size="sm"
                      required
                    />
                  </FormField>
                  <FormField label="Payload" labelSize="xs" error={v.payloadError}>
                    <span className="font-normal text-xs text-zinc-400">(optional JSON)</span>
                      <Textarea
                        value={v.payloadRaw}
                        onChange={(e) => updateDraft(v.clientId, "payloadRaw", e.target.value)}
                        placeholder='{"color": "blue"}'
                        rows={2}
                      size="sm"
                      mono
                      className={v.payloadError ? "border-red-300 bg-red-50/50" : ""}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-500">Add variant</p>
            <div className="flex items-end gap-3">
              <FormField label="Key" labelSize="xs" className="flex-1">
                <Input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="e.g. control"
                  size="sm"
                />
              </FormField>
              <FormField label="Name" labelSize="xs" className="flex-1">
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Control"
                  size="sm"
                />
              </FormField>
            </div>
            <FormField label="Payload" labelSize="xs" error={newPayloadError} className="mt-2">
              <span className="font-normal text-xs text-zinc-400">(optional JSON)</span>
              <Textarea
                value={newPayload}
                onChange={(e) => {
                  setNewPayload(e.target.value);
                  setNewPayloadError("");
                }}
                placeholder='{"color": "blue"}'
                rows={2}
                size="sm"
                mono
                className={newPayloadError ? "border-red-300 bg-red-50/50" : ""}
              />
            </FormField>
            <div className="mt-2 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={addVariant}
                disabled={!newKey.trim() || !newName.trim()}
              >
                + Add
              </Button>
            </div>
          </div>

          <ErrorAlert message={error} className="mt-3" />

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving} loadingText="Saving...">
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
  );
}
