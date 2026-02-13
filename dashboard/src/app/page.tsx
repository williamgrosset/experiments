"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchExperiments, fetchEnvironments } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Experiment, Environment, ExperimentStatus } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { StatusBadge } from "@/components/status-badge";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-layout";
import { StatCard } from "@/components/stat-card";

export default function OverviewPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchExperiments(), fetchEnvironments()])
      .then(([exps, envs]) => {
        setExperiments(exps);
        setEnvironments(envs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusCounts = experiments.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    },
    {} as Record<ExperimentStatus, number>,
  );

  const stats = [
    { label: "Total experiments", value: experiments.length },
    { label: "Running", value: statusCounts.RUNNING || 0 },
    { label: "Draft", value: statusCounts.DRAFT || 0 },
    { label: "Environments", value: environments.length },
  ];

  const columns: Column<Experiment>[] = [
    {
      key: "name",
      header: "Name",
      render: (exp) => (
        <Link
          href={`/experiments/${exp.id}`}
          className="font-medium text-zinc-900 hover:underline"
        >
          {exp.name}
        </Link>
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
      key: "created",
      header: "Created",
      className: "px-4 py-3 text-zinc-500",
      render: (exp) => formatDate(exp.createdAt),
    },
  ];

  if (loading) {
    return <Spinner />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        subtitle="A summary of your experimentation platform."
      />

      {/* Stats grid */}
      <div className="mb-10 grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {/* Recent experiments */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900">
          Recent experiments
        </h2>
        <Link
          href="/experiments"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          View all &rarr;
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={experiments.slice(0, 5)}
        rowKey={(exp) => exp.id}
        emptyMessage={
          <>
            No experiments yet.{" "}
            <Link href="/experiments/new" className="text-zinc-900 underline">
              Create one
            </Link>
          </>
        }
      />
    </PageContainer>
  );
}
