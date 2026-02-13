"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchExperiments, fetchEnvironments } from "@/lib/api";
import { statusColor, statusDot, formatDate } from "@/lib/utils";
import type { Experiment, Environment, ExperimentStatus } from "@/lib/types";

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

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Experiments</h1>
          <p className="mt-1 text-sm text-zinc-500">
            View and manage all experiments across environments.
          </p>
        </div>
        <Link
          href="/experiments/new"
          className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Create experiment
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterEnv}
          onChange={(e) => setFilterEnv(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400"
        >
          <option value="">All environments</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-400"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(filterEnv || filterStatus) && (
          <button
            onClick={() => {
              setFilterEnv("");
              setFilterStatus("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-900"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60">
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Name</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Key</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Environment</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Variants</th>
                <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {experiments.map((exp) => (
                <tr key={exp.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-4 py-3">
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
                    {exp.variants.length}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(exp.createdAt)}
                  </td>
                </tr>
              ))}
              {experiments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                    No experiments found.{" "}
                    <Link href="/experiments/new" className="text-zinc-900 underline">
                      Create one
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
