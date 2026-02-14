"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchEnvironments, createEnvironment } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Environment } from "@experiments/shared";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, type Column } from "@/components/data-table";
import { PageContainer, PageHeader } from "@/components/page-layout";
import { Input, FormField } from "@/components/form";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 10;

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetchEnvironments({ page, pageSize: PAGE_SIZE })
      .then((res) => {
        setEnvironments(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await createEnvironment(name.trim());
      setName("");
      setShowCreate(false);
      // Reload current page to reflect new data
      load();
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

  if (loading && environments.length === 0) {
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
      {loading ? (
        <Spinner fullPage={false} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={environments}
            rowKey={(env) => env.id}
            emptyMessage="No environments yet. Create one to get started."
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
    </PageContainer>
  );
}
