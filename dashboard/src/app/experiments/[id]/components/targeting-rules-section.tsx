import { useState } from "react";
import type { Experiment, TargetingRule } from "@experiments/shared";
import { updateExperiment } from "@/lib/api";
import { buildTargetingRulesPayload } from "@/lib/targeting-rules";
import { Button } from "@/components/button";
import { ErrorAlert } from "@/components/error-alert";
import { RulesBuilder } from "@/components/experiments/rules-builder";

interface TargetingRulesSectionProps {
  experiment: Experiment;
  isArchived: boolean;
  onUpdated: (experiment: Experiment) => void;
}

export function TargetingRulesSection({
  experiment,
  isArchived,
  onUpdated,
}: TargetingRulesSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TargetingRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit() {
    const rules = experiment.targetingRules ?? [];
    setDraft(rules.length > 0 ? JSON.parse(JSON.stringify(rules)) : []);
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
        targetingRules: buildTargetingRulesPayload(draft) ?? [],
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save targeting rules");
    } finally {
      setSaving(false);
    }
  }

  const currentRules = experiment.targetingRules ?? [];
  const rulesCount = currentRules.length;
  const conditionsCount = currentRules.reduce((sum, r) => sum + r.conditions.length, 0);

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900">Targeting rules</h2>
        {!isArchived && !editing && (
          <Button variant="ghost" size="xs" onClick={startEdit}>
            Edit rules
          </Button>
        )}
      </div>

      {editing ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
          <RulesBuilder
            rules={draft}
            setRules={setDraft}
            cardClassName="rounded-lg border border-zinc-200 bg-white p-4"
          />
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
          {rulesCount > 0 ? (
            <p className="text-sm text-zinc-700">
              {rulesCount} {rulesCount === 1 ? "rule" : "rules"}, {conditionsCount}{" "}
              {conditionsCount === 1 ? "condition" : "conditions"}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">No targeting rules — all users are eligible.</p>
          )}
        </div>
      )}
    </div>
  );
}
