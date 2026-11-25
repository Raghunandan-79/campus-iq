"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ListResponse, type ResourceListItem } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { ResourceCard } from "@/components/resource-card";

function BookmarksContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-bookmarks"],
    queryFn: () => api.get<{ data: { bookmarks: ResourceListItem[] } }>("/bookmarks"),
  });

  const items = data?.data.bookmarks ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Saved resources</h1>
      <p className="mt-1 text-sm text-muted">Resources you bookmarked for later.</p>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Bookmark resources from the explore page to find them here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  return (
    <RequireAuth>
      <BookmarksContent />
    </RequireAuth>
  );
}
