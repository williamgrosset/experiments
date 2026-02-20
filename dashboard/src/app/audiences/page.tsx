"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchEnvironments,
  fetchAudiences,
  createAudience,
  updateAudience,
  deleteAudience,
} from "@/lib/api";
import type {
  Audience,
  Environment,
  RuleOperator,
  TargetingCondition,
  TargetingRule,
} from "@experiments/shared";
import { formatDate } from "@/lib/utils";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-layout";
import { ErrorAlert } from "@/components/error-alert";
import { Input, Select, FormField } from "@/components/form";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 10;

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
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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

function RulesBuilder({
  rules,
  setRules,
}: {
  rules: TargetingRule[];
  setRules: React.Dispatch<React.SetStateAction<TargetingRule[]>>;
}) {
  function addRule() {
    setRules((prev) => [...prev, emptyRule()]);
  }

  function removeRule(ruleIndex: number) {
    setRules((prev) => prev.filter((_, i) => i !== ruleIndex));
  }

  function addCondition(ruleIndex: number) {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: [...rule.conditions, emptyCondition()] }
          : rule,
      ),
    );
  }

  function removeCondition(ruleIndex: number, condIndex: number) {
    setRules((prev) =>
      prev.map((rule, i) =>
        i === ruleIndex
          ? {
              ...rule,
              conditions: rule.conditions.filter((_, j) => j !== condIndex),
            }
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
    setRules((prev) =>
      prev.map((rule, ri) =>
        ri === ruleIndex
          ? {
              ...rule,
              conditions: rule.conditions.map((cond, ci) => {
                if (ci !== condIndex) return cond;
                if (field === "operator") {
                  return { ...cond, operator: value as RuleOperator };
                }
                if (field === "attribute") {
                  return { ...cond, attribute: value };
                }
                return {
                  ...cond,
                  value,
                };
              }),
            }
          : rule,
      ),
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-sm font-medium text-zinc-700">
          Rules
          <span className="ml-1 font-normal text-zinc-400">(required)</span>
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

      {rules.length === 0 ? (
        <p className="mt-1.5 text-sm text-zinc-400">
          Add at least one rule to define this audience.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {rules.map((rule, ruleIndex) => (
            <div
              key={ruleIndex}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Rule {ruleIndex + 1}
                  {rules.length > 1 && ruleIndex < rules.length - 1 && (
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
                          updateCondition(
                            ruleIndex,
                            condIndex,
                            "attribute",
                            e.target.value,
                          )
                        }
                        size="sm"
                        mono
                        className="w-1/3"
                      />
                      <Select
                        value={condition.operator}
                        onChange={(e) =>
                          updateCondition(
                            ruleIndex,
                            condIndex,
                            "operator",
                            e.target.value,
                          )
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
                          condition.operator === "in" ||
                          condition.operator === "notIn"
                            ? "val1, val2, ..."
                            : "value"
                        }
                        value={serializeConditionValue(condition.value)}
                        onChange={(e) =>
                          updateCondition(
                            ruleIndex,
                            condIndex,
                            "value",
                            e.target.value,
                          )
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

      {rules.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">
          Users matching <span className="font-medium">any</span> rule are in
          this audience. Within a rule, <span className="font-medium">all</span>{" "}
          conditions must match.
        </p>
      )}
    </div>
  );
}

function normalizeRules(rules: TargetingRule[]): TargetingRule[] {
  return rules
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
}

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filterEnv, setFilterEnv] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEnvironmentId, setCreateEnvironmentId] = useState("");
  const [createRules, setCreateRules] = useState<TargetingRule[]>([]);
  const [createError, setCreateError] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editingAudienceId, setEditingAudienceId] = useState("");
  const [editName, setEditName] = useState("");
  const [editRules, setEditRules] = useState<TargetingRule[]>([]);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAudienceId, setDeletingAudienceId] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAudiences({
      environmentId: filterEnv || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setAudiences(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load audiences");
      })
      .finally(() => setLoading(false));
  }, [filterEnv, page]);

  useEffect(() => {
    fetchEnvironments({ page: 1, pageSize: 100 })
      .then((res) => {
        setEnvironments(res.data);
        if (res.data.length > 0) {
          setCreateEnvironmentId(res.data[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setShowCreate(true);
    setCreateName("");
    setCreateRules([]);
    setCreateError("");
    if (environments.length > 0 && !createEnvironmentId) {
      setCreateEnvironmentId(environments[0].id);
    }
  }

  function openEdit(audience: Audience) {
    setShowEdit(true);
    setEditingAudienceId(audience.id);
    setEditName(audience.name);
    setEditRules(audience.rules);
    setEditError("");
  }

  function openDelete(id: string) {
    setDeletingAudienceId(id);
    setShowDeleteConfirm(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    const rules = normalizeRules(createRules);
    if (rules.length === 0) {
      setCreateError("Add at least one complete rule.");
      setCreating(false);
      return;
    }

    try {
      await createAudience({
        name: createName.trim(),
        environmentId: createEnvironmentId,
        rules,
      });
      setShowCreate(false);
      setPage(1);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create audience");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAudienceId) return;

    setUpdating(true);
    setEditError("");

    const rules = normalizeRules(editRules);
    if (rules.length === 0) {
      setEditError("Add at least one complete rule.");
      setUpdating(false);
      return;
    }

    try {
      await updateAudience(editingAudienceId, {
        name: editName.trim(),
        rules,
      });
      setShowEdit(false);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update audience");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deletingAudienceId) return;

    setDeleting(true);
    setError("");

    try {
      await deleteAudience(deletingAudienceId);
      setShowDeleteConfirm(false);
      setDeletingAudienceId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete audience");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const columns: Column<Audience>[] = [
    {
      key: "name",
      header: "Name",
      className: "px-4 py-3 font-medium text-zinc-900",
      render: (audience) => audience.name,
    },
    {
      key: "environment",
      header: "Environment",
      className: "px-4 py-3 text-zinc-600",
      render: (audience) => audience.environment?.name ?? "\u2014",
    },
    {
      key: "rules",
      header: "Rules",
      className: "px-4 py-3 text-zinc-500",
      render: (audience) => `${audience.rules.length} rule${audience.rules.length === 1 ? "" : "s"}`,
    },
    {
      key: "updated",
      header: "Updated",
      className: "px-4 py-3 text-zinc-500",
      render: (audience) => formatDate(audience.updatedAt),
    },
    {
      key: "actions",
      header: "Actions",
      className: "px-4 py-3 text-right",
      render: (audience) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openEdit(audience)}
            className="text-zinc-600"
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openDelete(audience.id)}
            className="text-red-500 hover:text-red-600"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Audiences"
        subtitle="Create reusable rule groups and attach them to experiments."
        action={<Button onClick={openCreate}>Create audience</Button>}
      />

      <ErrorAlert message={error} className="mb-4" />

      <div className="mb-4 flex items-center gap-3">
        <Select
          value={filterEnv}
          onChange={(e) => {
            setFilterEnv(e.target.value);
            setPage(1);
          }}
          variant="filter"
          size="sm"
          className="w-auto"
        >
          <option value="">All environments</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner fullPage={false} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={audiences}
            rowKey={(audience) => audience.id}
            hoverRows={false}
            emptyMessage="No audiences yet. Create one to reuse targeting across experiments."
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateError("");
        }}
        title="Create audience"
        description="Define reusable rules to apply across multiple experiments."
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleCreate} className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" error={createError}>
              <Input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. US Pro Users"
                required
                autoFocus
              />
            </FormField>
            <FormField label="Environment">
              <Select
                value={createEnvironmentId}
                onChange={(e) => setCreateEnvironmentId(e.target.value)}
                required
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <RulesBuilder rules={createRules} setRules={setCreateRules} />

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateError("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!createName.trim() || !createEnvironmentId}
              loading={creating}
              loadingText="Creating..."
            >
              Create audience
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showEdit}
        onClose={() => {
          setShowEdit(false);
          setEditError("");
        }}
        title="Edit audience"
        description="Update audience name and rule set."
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleUpdate} className="mt-5 space-y-5">
          <FormField label="Name" error={editError}>
            <Input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </FormField>

          <RulesBuilder rules={editRules} setRules={setEditRules} />

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowEdit(false);
                setEditError("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={updating} loadingText="Saving...">
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingAudienceId("");
        }}
        title="Delete audience"
        maxWidth="max-w-sm"
      >
        <p className="mt-2 text-sm text-zinc-500">
          Are you sure you want to delete this audience? Experiments using it
          will keep their individual targeting rules and have no audience
          selected.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeletingAudienceId("");
            }}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={handleDelete}
            loading={deleting}
            loadingText="Deleting..."
          >
            Delete
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
