"use client";

import Link from "next/link";
import { Bookmark, Download, FileText, Link2, MessageSquare, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { api, RESOURCE_TYPE_LABELS, type ResourceListItem } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useToast } from "./toast";
import { formatBytes, timeAgo } from "@/lib/format";
import { Badge } from "./ui/card";
import { VoteButtons } from "./vote-buttons";

export function ResourceCard({
  resource,
  showVote = true,
}: {
  resource: ResourceListItem;
  showVote?: boolean;
}) {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();

  const canDelete =
    !!user &&
    (user.id === resource.uploadedBy || user.role === "moderator" || user.role === "admin");

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/resources/${resource.id}`),
    onSuccess: () => qc.invalidateQueries(),
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (resource.bookmarked) {
        return api.delete(`/resources/${resource.id}/bookmark`);
      }
      return api.post(`/resources/${resource.id}/bookmark`);
    },
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <article className="flex gap-3 rounded-lg border border-border bg-white p-4 transition-colors hover:border-neutral-300">
      {showVote && (
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <VoteButtons
            kind="resource"
            target={resource}
            size="sm"
            queryKeys={[["resources"]]}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Badge tone="accent">{RESOURCE_TYPE_LABELS[resource.resourceType]}</Badge>
          <Link
            href={`/subjects/${resource.subject.id}`}
            className="font-medium text-foreground hover:text-accent"
          >
            {resource.subject.name}
          </Link>
          {(resource.semester ?? resource.subject.semester) && (
            <span>Sem {resource.semester ?? resource.subject.semester}</span>
          )}
          {resource.batchYear && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">Batch {resource.batchYear}</span>
            </>
          )}
          <span>·</span>
          <Link href={`/colleges/${resource.college.id}`} className="hover:text-accent">
            {resource.college.name}
          </Link>
          <span>·</span>
          <span>{timeAgo(resource.createdAt)}</span>
        </div>

        <Link href={`/resources/${resource.id}`} className="mt-1.5 block">
          <h3 className="truncate text-[15px] font-semibold text-foreground hover:text-accent">
            {resource.title}
          </h3>
        </Link>
        {resource.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">
            {resource.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            {resource.resourceType === "link" ? (
              <Link2 className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {resource.resourceType === "link"
              ? "External link"
              : `${resource.originalFilename ?? "document"}${resource.fileSize ? ` · ${formatBytes(resource.fileSize)}` : ""}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            {resource.downloadCount} downloads
          </span>
          <Link
            href={`/resources/${resource.id}#reviews`}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reviews
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                toast("Please sign in or sign up first");
                setTimeout(() => router.push("/auth/sign-in"), 600);
                return;
              }
              bookmarkMutation.mutate();
            }}
            className={clsx(
              "ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors",
              resource.bookmarked
                ? "text-accent"
                : "text-muted hover:bg-surface hover:text-foreground",
            )}
            aria-label={resource.bookmarked ? "Remove bookmark" : "Bookmark"}
          >
            <Bookmark className="h-3.5 w-3.5" fill={resource.bookmarked ? "currentColor" : "none"} />
            {resource.bookmarked ? "Saved" : "Save"}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this resource? This cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted transition-colors hover:bg-surface hover:text-danger"
              aria-label="Delete resource"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
