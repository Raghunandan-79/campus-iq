"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type ResourceListItem } from "@/lib/api";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { ResourceCard } from "@/components/resource-card";
import { formatBytes, timeAgo } from "@/lib/format";

interface MyResource extends ResourceListItem {
  subjectName?: string;
  collegeName?: string;
  moderationStatus?: string;
  uploadStatus?: string;
}

function MyResourcesContent() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-resources"],
    queryFn: () => api.get<{ data: { resources: MyResource[] } }>("/users/me/resources"),
  });

  const items = data?.data.resources ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">My resources</h1>
      <p className="mt-1 text-sm text-muted">
        Everything you've shared on CampusIQ.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No uploads yet"
            description="Resources you upload will appear here."
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

export default function MyResourcesPage() {
  return (
    <RequireAuth>
      <MyResourcesContent />
    </RequireAuth>
  );
}
