"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, type ListResponse, type Subject } from "@/lib/api";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { Input } from "@/components/ui/field";

export default function SubjectsPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subjects", submitted],
    queryFn: () =>
      api.get<ListResponse<Subject>>(
        `/subjects?pageSize=100${submitted ? `&q=${encodeURIComponent(submitted)}` : ""}`,
      ),
  });

  const items = data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
        <p className="mt-1 text-sm text-muted">
          Browse academic subjects and find resources across colleges.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
        className="mb-6 flex max-w-md gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subjects…" className="pl-9" />
        </div>
        <button type="submit" className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
          Search
        </button>
      </form>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No subjects found" description="Try a different search." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <Link key={s.id} href={`/subjects/${s.id}`}>
              <Card className="h-full p-4 transition-colors hover:border-accent">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{s.name}</h3>
                  {s.code && (
                    <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">
                      {s.code}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {s.semester ? `Semester ${s.semester}` : "All semesters"}
                  {s.collegeName ? ` · ${s.collegeName}` : " · Shared across colleges"}
                </p>
                {s.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
