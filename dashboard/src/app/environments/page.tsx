"use client";

import { useEffect, useState } from "react";
import { fetchEnvironments, createEnvironment } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Environment } from "@/lib/types";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-layout";
import { Input, FormField } from "@/components/form";

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

  const columns: Column<Environment>[] = [
    {
      key: "name",
      header: "Name",
      className: "px-4 py-3 font-medium text-zinc-900",
      render: (env) => env.name,
    },
    {
      key: "id",
      header: "ID",
      className: "px-4 py-3 font-mono text-xs text-zinc-500",
      render: (env) => env.id,
    },
    {
      key: "created",
      header: "Created",
      className: "px-4 py-3 text-zinc-500",
      render: (env) => formatDate(env.createdAt),
    },
  ];

  if (loading) {
    return <Spinner />;
  }

  return (
    <PageContainer maxWidth="3xl">
      <PageHeader
        title="Environments"
        subtitle="Manage deployment environments for your experiments."
        action={
          <Button onClick={() => setShowCreate(true)}>
            Create environment
          </Button>
        }
      />

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setError("");
        }}
        title="Create environment"
        description="Environments isolate experiments across deployment stages."
      >
        <form onSubmit={handleCreate} className="mt-5">
          <FormField label="Name" error={error}>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. production"
              required
              autoFocus
            />
          </FormField>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setShowCreate(false);
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              loading={creating}
              loadingText="Creating..."
            >
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Table */}
      <DataTable
        columns={columns}
        data={environments}
        rowKey={(env) => env.id}
        emptyMessage="No environments yet. Create one to get started."
      />
    </PageContainer>
  );
}
