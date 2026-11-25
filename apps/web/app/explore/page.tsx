"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  api,
  RESOURCE_TYPE_LABELS,
  type ListResponse,
  type ResourceListItem,
  type ResourceType,
} from "@/lib/api";
import { ResourceCard } from "@/components/resource-card";
import { Pagination } from "@/components/pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

function ExploreInner() {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const subjectId = params.get("subjectId") ?? "";
  const collegeId = params.get("collegeId") ?? "";
  const resourceType = params.get("resourceType") ?? "";
  const semester = params.get("semester") ?? "";
  const batchYear = params.get("batchYear") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [draftQ, setDraftQ] = useState(q);
  useEffect(() => setDraftQ(q), [q]);

  const { data: colleges } = useQuery({
    queryKey: ["colleges", "options"],
    queryFn: () => api.get<ListResponse<{ id: string; name: string }>>("/colleges?pageSize=100"),
    staleTime: 300_000,
  });

  const queryString = new URLSearchParams();
  if (q) queryString.set("q", q);
  if (subjectId) queryString.set("subjectId", subjectId);
  if (collegeId) queryString.set("collegeId", collegeId);
  if (resourceType) queryString.set("resourceType", resourceType);
  if (semester) queryString.set("semester", semester);
  if (batchYear) queryString.set("batchYear", batchYear);
  queryString.set("sort", sort);
  queryString.set("page", String(page));
  queryString.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["resources", "list", queryString.toString()],
    queryFn: () =>
      api.get<ListResponse<ResourceListItem>>(`/resources?${queryString}`),
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`/explore?${next.toString()}`);
  };

  const hasFilters = !!(q || subjectId || collegeId || resourceType || semester || batchYear);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Explore resources</h1>
        <p className="mt-1 text-sm text-muted">
          Notes, PYQs and study material shared across colleges.
        </p>
      </div>

      {/* Search + filters */}
      <div className="mb-6 space-y-3 rounded-lg border border-border bg-white p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam("q", draftQ.trim());
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              placeholder="Search title or description…"
              className="pl-9"
            />
          </div>
          <Button type="submit">Search</Button>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/explore")}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="font-medium">Filters</span>
          </div>
          <Select
            value={resourceType}
            onChange={(e) => setParam("resourceType", e.target.value)}
            className="w-40"
            aria-label="Resource type"
          >
            <option value="">All types</option>
            {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select
            value={semester}
            onChange={(e) => setParam("semester", e.target.value)}
            className="w-32"
            aria-label="Semester"
          >
            <option value="">All sems</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>Sem {s}</option>
            ))}
          </Select>
          <Select
            value={batchYear}
            onChange={(e) => setParam("batchYear", e.target.value)}
            className="w-32"
            aria-label="Batch year"
          >
            <option value="">All batches</option>
            {Array.from({ length: 8 }, (_, i) => 2024 + i).map((y) => (
              <option key={y} value={y}>Batch {y}</option>
            ))}
          </Select>
          <Select
            value={collegeId}
            onChange={(e) => setParam("collegeId", e.target.value)}
            className="w-52"
            aria-label="College"
          >
            <option value="">All colleges</option>
            {(colleges?.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="w-36"
            aria-label="Sort"
          >
            <option value="newest">Newest</option>
            <option value="top">Top rated</option>
            <option value="downloads">Most downloaded</option>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          title="No resources found"
          description={
            hasFilters
              ? "Try broadening your search or clearing filters."
              : "Nothing has been shared yet. Upload the first resource."
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.pagination.total}
            onPage={(p) => setParam("page", String(p))}
          />
        </>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><Skeleton className="h-96 w-full" /></div>}>
      <ExploreInner />
    </Suspense>
  );
}
