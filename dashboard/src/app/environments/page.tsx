"use client";

import { useEffect, useState } from "react";
import { fetchEnvironments, createEnvironment } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Environment } from "@/lib/types";

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEnvironments()
      .then(setEnvironments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const env = await createEnvironment(name.trim());
      setEnvironments((prev) => [...prev, env]);
      setName("");
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create environment");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Environments</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage deployment environments for your experiments.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Create environment
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">Create environment</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Environments isolate experiments across deployment stages.
            </p>
            <form onSubmit={handleCreate} className="mt-5">
              <label className="block text-sm font-medium text-zinc-700">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. production"
                className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                required
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setError("");
                  }}
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/60">
              <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Name</th>
              <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">ID</th>
              <th className="px-4 py-2.5 text-xs font-medium text-zinc-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {environments.map((env) => (
              <tr key={env.id} className="transition-colors hover:bg-zinc-50/50">
                <td className="px-4 py-3 font-medium text-zinc-900">{env.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{env.id}</td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(env.createdAt)}</td>
              </tr>
            ))}
            {environments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-400">
                  No environments yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
