"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchExperiments, fetchEnvironments } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Experiment, Environment, ExperimentStatus } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { Button, ButtonLink } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-layout";
import { Select } from "@/components/form";

const STATUSES: ExperimentStatus[] = ["DRAFT", "RUNNING", "PAUSED", "ARCHIVED"];

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEnv, setFilterEnv] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params: { environmentId?: string; status?: ExperimentStatus } = {};
    if (filterEnv) params.environmentId = filterEnv;
    if (filterStatus) params.status = filterStatus as ExperimentStatus;
    fetchExperiments(params)
      .then(setExperiments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterEnv, filterStatus]);

  useEffect(() => {
    fetchEnvironments().then(setEnvironments).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<Experiment>[] = [
    {
      key: "name",
      header: "Name",
      render: (exp) => (
        <div>
          <Link
            href={`/experiments/${exp.id}`}
            className="font-medium text-zinc-900 hover:underline"
          >
            {exp.name}
          </Link>
          {exp.description && (
            <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">
              {exp.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "key",
      header: "Key",
      className: "px-4 py-3 font-mono text-xs text-zinc-500",
      render: (exp) => exp.key,
    },
    {
      key: "environment",
      header: "Environment",
      className: "px-4 py-3 text-zinc-600",
      render: (exp) => exp.environment?.name ?? "\u2014",
    },
    {
      key: "status",
      header: "Status",
      render: (exp) => <StatusBadge status={exp.status} />,
    },
    {
      key: "variants",
      header: "Variants",
      className: "px-4 py-3 text-zinc-500",
      render: (exp) => exp.variants.length,
    },
    {
      key: "created",
      header: "Created",
      className: "px-4 py-3 text-zinc-500",
      render: (exp) => formatDate(exp.createdAt),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Experiments"
        subtitle="View and manage all experiments across environments."
        action={
          <ButtonLink href="/experiments/new">Create experiment</ButtonLink>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={filterEnv}
          onChange={(e) => setFilterEnv(e.target.value)}
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
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          variant="filter"
          size="sm"
          className="w-auto"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {(filterEnv || filterStatus) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setFilterEnv("");
              setFilterStatus("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <Spinner fullPage={false} />
      ) : (
        <DataTable
          columns={columns}
          data={experiments}
          rowKey={(exp) => exp.id}
          emptyMessage={
            <>
              No experiments found.{" "}
              <Link href="/experiments/new" className="text-zinc-900 underline">
                Create one
              </Link>
            </>
          }
        />
      )}
    </PageContainer>
  );
}
