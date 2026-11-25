"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  api,
  type ListResponse,
  type ResourceListItem,
  type Subject,
} from "@/lib/api";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { ResourceCard } from "@/components/resource-card";

export default function SubjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: subjectData, isLoading, isError } = useQuery({
    queryKey: ["subject", id],
    queryFn: () => api.get<{ data: { subject: Subject } }>(`/subjects/${id}`),
  });

  const { data: resourcesData } = useQuery({
    queryKey: ["subject-resources", id],
    queryFn: () =>
      api.get<ListResponse<ResourceListItem>>(`/resources?subjectId=${id}&pageSize=50`),
    enabled: !!subjectData,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (isError || !subjectData) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ErrorState message="Subject not found." />
      </div>
    );
  }

  const s = subjectData.data.subject;
  const resources = resourcesData?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/subjects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All subjects
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{s.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {s.code ? `${s.code} · ` : ""}
        {s.semester ? `Semester ${s.semester}` : "All semesters"}
        {s.collegeName ? ` · ${s.collegeName}` : " · Shared across colleges"}
      </p>
      {s.description && (
        <p className="mt-3 max-w-2xl text-sm text-muted">{s.description}</p>
      )}

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold tracking-tight">
          Resources{" "}
          <span className="text-sm font-normal text-muted">({resources.length})</span>
        </h2>
        {resources.length === 0 ? (
          <EmptyState
            title="No resources yet"
            description="No resources have been shared for this subject."
            action={
              <Link href="/upload" className="text-sm font-medium text-accent hover:underline">
                Upload the first one →
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
