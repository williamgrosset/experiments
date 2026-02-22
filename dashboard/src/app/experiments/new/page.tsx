"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchEnvironments,
  fetchAudiences,
  createExperiment,
} from "@/lib/api";
import type {
  Environment,
  Audience,
  TargetingRule,
} from "@experiments/shared";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/button";
import { Input, Textarea, Select, FormField } from "@/components/form";
import { PageContainer, PageHeader } from "@/components/page-layout";
import { ErrorAlert } from "@/components/error-alert";
import { RulesBuilder } from "@/components/experiments/rules-builder";
import { buildTargetingRulesPayload } from "@/lib/targeting-rules";

export default function NewExperimentPage() {
  const router = useRouter();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [targetingRules, setTargetingRules] = useState<TargetingRule[]>([]);

  useEffect(() => {
    fetchEnvironments({ page: 1, pageSize: 100 })
      .then((res) => {
        setEnvironments(res.data);
        if (res.data.length > 0) setEnvironmentId(res.data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!environmentId) {
      setAudiences([]);
      setAudienceId("");
      return;
    }

    fetchAudiences({ environmentId, page: 1, pageSize: 100 })
      .then((res) => {
        setAudiences(res.data);
        setAudienceId((current) =>
          res.data.some((aud) => aud.id === current) ? current : "",
        );
      })
      .catch(console.error);
  }, [environmentId]);

  // Auto-generate key from name
  function handleNameChange(val: string) {
    setName(val);
    setKey(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const exp = await createExperiment({
        key: key.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        environmentId,
        audienceId: audienceId || undefined,
        targetingRules: buildTargetingRulesPayload(targetingRules),
      });
      router.push(`/experiments/${exp.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create experiment");
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <PageContainer maxWidth="xl">
      <PageHeader
        title="Create experiment"
        subtitle="Set up a new experiment. You can add variants and allocations after creation."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Name">
          <Input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Homepage hero test"
            required
            autoFocus
          />
        </FormField>

        <FormField
          label="Key"
          hint="Used as the experiment identifier in code. Must be unique per environment."
        >
          <Input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. homepage-hero-test"
            mono
            required
          />
        </FormField>

        <FormField label="Description" optional>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Briefly describe what this experiment tests..."
          />
        </FormField>

        <FormField label="Environment">
          {environments.length > 0 ? (
            <Select
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-zinc-500">
              No environments found.{" "}
              <a href="/environments" className="underline">
                Create one first
              </a>
              .
            </p>
          )}
        </FormField>

        <FormField
          label="Audience"
          optional
          hint="Pick a reusable audience for this experiment, or leave empty for no audience filter."
        >
          <Select
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            disabled={!environmentId}
          >
            <option value="">No audience</option>
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id}>
                {audience.name}
              </option>
            ))}
          </Select>
        </FormField>

        <RulesBuilder rules={targetingRules} setRules={setTargetingRules} />

        <ErrorAlert message={error} />

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="submit"
            disabled={!environmentId}
            loading={submitting}
            loadingText="Creating..."
          >
            Create experiment
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
