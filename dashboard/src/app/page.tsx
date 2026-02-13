"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchExperiments, fetchEnvironments } from "@/lib/api";
import { statusColor, statusDot, formatDate } from "@/lib/utils";
import type { Experiment, Environment, ExperimentStatus } from "@/lib/types";

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A summary of your experimentation platform.
        </p>
      </div>

      {/* Stats grid */}
      <div className="mb-10 grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-200 bg-white px-5 py-4"
          >
            <p className="text-xs font-medium text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {s.value}
            </p>
          </div>
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
                Environment
              </th>
              <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">
                Status
              </th>
              <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {experiments.slice(0, 5).map((exp) => (
              <tr key={exp.id} className="transition-colors hover:bg-zinc-50/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/experiments/${exp.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {exp.name}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {exp.key}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {exp.environment?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(exp.status)}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot(exp.status)}`}
                    />
                    {exp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {formatDate(exp.createdAt)}
                </td>
              </tr>
            ))}
            {experiments.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  No experiments yet.{" "}
                  <Link
                    href="/experiments/new"
                    className="text-zinc-900 underline"
                  >
                    Create one
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
