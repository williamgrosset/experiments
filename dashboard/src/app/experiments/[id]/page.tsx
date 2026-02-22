"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchExperiment, fetchAudiences, deleteExperiment } from "@/lib/api";
import type { Audience, Experiment } from "@experiments/shared";
import { Spinner } from "@/components/spinner";
import { PageContainer } from "@/components/page-layout";
import { ExperimentHeader } from "./components/experiment-header";
import { DeleteExperimentModal } from "./components/delete-experiment-modal";
import { ExperimentMeta } from "./components/experiment-meta";
import { ExperimentFooter } from "./components/experiment-footer";
import { AudienceSection } from "./components/audience-section";
import { TargetingRulesSection } from "./components/targeting-rules-section";
import { VariantsSection } from "./components/variants-section";
import { AllocationsSection } from "./components/allocations-section";

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchExperiment(id)
      .then((exp) => {
        setExperiment(exp);
        return fetchAudiences({ environmentId: exp.environmentId, page: 1, pageSize: 100 });
      })
      .then((res) => setAudiences(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!experiment) return;
    setDeleting(true);
    try {
      await deleteExperiment(experiment.id);
      router.push("/experiments");
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) return <Spinner />;

  if (!experiment) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-500">Experiment not found.</p>
        <Link href="/experiments" className="text-sm text-zinc-900 underline">
          Back to experiments
        </Link>
      </div>
    );
  }

  const isArchived = experiment.status === "ARCHIVED";

  return (
    <PageContainer maxWidth="4xl">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400">
        <Link href="/experiments" className="hover:text-zinc-700">
          Experiments
        </Link>
        <span>/</span>
        <span className="text-zinc-700">{experiment.name}</span>
      </nav>

      <ExperimentHeader
        experiment={experiment}
        onUpdated={setExperiment}
        onReload={load}
        onDeleteClick={() => setShowDeleteConfirm(true)}
      />

      <DeleteExperimentModal
        experiment={experiment}
        open={showDeleteConfirm}
        deleting={deleting}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />

      <ExperimentMeta experiment={experiment} />

      <AudienceSection
        experiment={experiment}
        audiences={audiences}
        isArchived={isArchived}
        onUpdated={setExperiment}
      />

      <TargetingRulesSection
        experiment={experiment}
        isArchived={isArchived}
        onUpdated={setExperiment}
      />

      <VariantsSection experiment={experiment} isArchived={isArchived} onUpdated={setExperiment} />

      <AllocationsSection experiment={experiment} isArchived={isArchived} onUpdated={setExperiment} />

      <ExperimentFooter experiment={experiment} />
    </PageContainer>
  );
}
