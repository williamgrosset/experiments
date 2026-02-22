import { useState } from "react";
import type { Experiment, ExperimentStatus } from "@experiments/shared";
import { updateExperiment, updateExperimentStatus, publishExperiment } from "@/lib/api";
import { Button } from "@/components/button";
import { ErrorAlert } from "@/components/error-alert";
import { Input, Textarea } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";

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

interface ExperimentHeaderProps {
  experiment: Experiment;
  onUpdated: (experiment: Experiment) => void;
  onReload: () => void;
  onDeleteClick: () => void;
}

export function ExperimentHeader({
  experiment,
  onUpdated,
  onReload,
  onDeleteClick,
}: ExperimentHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(experiment.name);
  const [editDesc, setEditDesc] = useState(experiment.description ?? "");
  const [saving, setSaving] = useState(false);

  const [statusChanging, setStatusChanging] = useState<ExperimentStatus | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState("");

  function startEdit() {
    setEditName(experiment.name);
    setEditDesc(experiment.description ?? "");
    setError("");
    setEditing(true);
  }

  async function saveDetails() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateExperiment(experiment.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: ExperimentStatus) {
    setError("");
    setStatusChanging(status);
    try {
      const updated = await updateExperimentStatus(experiment.id, status);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusChanging(null);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setError("");
    try {
      await publishExperiment(experiment.id);
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  const transitions = STATUS_TRANSITIONS[experiment.status];

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
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
                <Button size="sm" onClick={saveDetails} loading={saving} loadingText="Saving...">
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
                onClick={startEdit}
                className="mt-2 text-zinc-400 hover:text-zinc-700"
              >
                Edit details
              </Button>
            </div>
          )}
        </div>

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
            onClick={onDeleteClick}
            className="text-xs"
          >
            Delete
          </Button>
        </div>
      </div>

      <ErrorAlert message={error} className="mt-4" />
    </div>
  );
}
