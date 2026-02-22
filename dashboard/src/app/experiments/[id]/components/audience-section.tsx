import { useState } from "react";
import type { Audience, Experiment } from "@experiments/shared";
import { updateExperiment } from "@/lib/api";
import { Button } from "@/components/button";
import { ErrorAlert } from "@/components/error-alert";
import { FormField, Select } from "@/components/form";

interface AudienceSectionProps {
  experiment: Experiment;
  audiences: Audience[];
  isArchived: boolean;
  onUpdated: (experiment: Experiment) => void;
}

export function AudienceSection({
  experiment,
  audiences,
  isArchived,
  onUpdated,
}: AudienceSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    setDraft(experiment.audienceId ?? "");
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateExperiment(experiment.id, {
        audienceId: draft || null,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save audience");
    } finally {
      setSaving(false);
    }
  }

  const currentAudience = experiment.audienceId
    ? audiences.find((a) => a.id === experiment.audienceId)
    : null;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900">Audience</h2>
        {!isArchived && !editing && (
          <Button variant="ghost" size="xs" onClick={startEdit}>
            Edit audience
          </Button>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
          <FormField
            label="Audience"
            optional
            hint="Pick a reusable audience for this experiment, or leave empty for no audience filter."
          >
            <Select value={draft} onChange={(e) => setDraft(e.target.value)}>
              <option value="">No audience</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
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
  );
}
