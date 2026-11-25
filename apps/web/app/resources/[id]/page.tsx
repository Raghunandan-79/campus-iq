"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Download,
  Flag,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import {
  api,
  ApiError,
  RESOURCE_TYPE_LABELS,
  type ListResponse,
  type ResourceDetail,
  type ResourceReview,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatBytes, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { VoteButtons } from "@/components/vote-buttons";

function ReportButton({ targetType, targetId, queryKey }: { targetType: string; targetId: string; queryKey: unknown[] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.post(
        targetType === "resource_review"
          ? `/reviews/${targetId}/report`
          : `/college-reviews/${targetId}/report`,
        { reason },
      ),
    onSuccess: () => {
      setDone(true);
      setOpen(false);
      qc.invalidateQueries({ queryKey });
    },
  });
  if (done) return <span className="text-xs text-muted">Reported</span>;
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
      >
        <Flag className="h-3 w-3" /> Report
      </button>
    );
  }
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for reporting…"
        className="h-8 flex-1 rounded-md border border-border px-2 text-xs"
      />
      <Button size="sm" variant="danger" disabled={reason.trim().length < 5 || mutation.isPending} onClick={() => mutation.mutate()}>
        Submit
      </Button>
    </div>
  );
}

function ReviewItem({
  review,
  resourceId,
  depth = 0,
}: {
  review: ResourceReview;
  resourceId: string;
  depth?: number;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(review.content);

  const queryKey = ["resource-reviews", resourceId];

  const replyMutation = useMutation({
    mutationFn: () =>
      api.post(`/resources/${resourceId}/reviews`, {
        content: replyText,
        parentReviewId: review.parentReviewId ? review.parentReviewId : review.id,
      }),
    onSuccess: () => {
      setReplyOpen(false);
      setReplyText("");
      qc.invalidateQueries({ queryKey });
    },
  });

  const editMutation = useMutation({
    mutationFn: () =>
      api.patch(`/reviews/${review.id}`, { content: editText }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/reviews/${review.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const isOwner = user?.id === review.userId;
  const isMod = user?.role === "moderator" || user?.role === "admin";

  return (
    <div className={clsx(depth > 0 && "ml-8 border-l-2 border-border pl-4")}>
      <div className="flex gap-2.5 py-3">
        <div className="pt-0.5">
          <VoteButtons kind="review" target={review} size="sm" queryKeys={[queryKey]} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="font-semibold text-foreground">{review.author.name}</span>
            <span>{timeAgo(review.createdAt)}</span>
            {review.author.collegeId && <span>· college student</span>}
          </div>
          {editing ? (
            <div className="mt-1.5">
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-16 text-sm" />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editText.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {review.content}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            {review.replies.length > 0 && depth === 0 && (
              <span className="text-xs text-muted">{review.replies.length} repl{review.replies.length === 1 ? "y" : "ies"}</span>
            )}
            <button
              className="text-xs font-medium text-muted hover:text-foreground"
              onClick={() => {
                if (!user) {
                  window.location.href = "/auth/sign-in";
                  return;
                }
                setReplyOpen((v) => !v);
              }}
            >
              Reply
            </button>
            {isOwner && !editing && (
              <button className="text-xs text-muted hover:text-foreground" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {(isOwner || isMod) && (
              <button
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
                onClick={() => {
                  if (confirm("Delete this review?")) deleteMutation.mutate();
                }}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
            <ReportButton targetType="resource_review" targetId={review.id} queryKey={queryKey} />
          </div>
          {replyOpen && (
            <div className="mt-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                className="min-h-16 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending || !replyText.trim()}>
                  Reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {review.replies.map((r) => (
        <ReviewItem key={r.id} review={r} resourceId={resourceId} depth={depth + 1} />
      ))}
    </div>
  );
}

function ReviewSection({ resourceId }: { resourceId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState("best");
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");

  const queryKey = ["resource-reviews", resourceId, sort, page];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.get<ListResponse<ResourceReview>>(
        `/resources/${resourceId}/reviews?sort=${sort}&page=${page}&pageSize=20`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/resources/${resourceId}/reviews`, { content: text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["resource-reviews", resourceId] });
    },
  });

  const reviews = data?.data ?? [];

  return (
    <section id="reviews" className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          Reviews & discussion
          {data ? <span className="ml-2 text-sm font-normal text-muted">({data.pagination.total})</span> : null}
        </h2>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-md border border-border bg-white px-2 text-sm"
          aria-label="Sort reviews"
        >
          <option value="best">Best</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      {user && (
        <Card className="mb-4 p-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your experience with this resource…"
            className="min-h-20 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !text.trim()}
            >
              Post review
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Be the first to share whether this resource is useful."
        />
      ) : (
        <Card className="divide-y divide-border px-4">
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} resourceId={resourceId} />
          ))}
        </Card>
      )}

      {data && data.pagination.total > data.pagination.pageSize && (
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * data.pagination.pageSize >= data.pagination.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}

export default function ResourceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user, isAuthenticated } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["resource", id],
    queryFn: () => api.get<{ data: { resource: ResourceDetail } }>(`/resources/${id}`),
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (r: ResourceDetail) =>
      r.bookmarked
        ? api.delete(`/resources/${r.id}/bookmark`)
        : api.post(`/resources/${r.id}/bookmark`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resource", id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/resources/${id}`),
    onSuccess: () => {
      window.location.href = "/my-resources";
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorState message="Resource not found or unavailable." />
      </div>
    );
  }

  const r = data.data.resource;
  const canDelete = user && (user.id === r.uploadedBy || user.role !== "student");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/explore" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to explore
      </Link>

      <div className="flex gap-4">
        <div className="hidden sm:block">
          <VoteButtons kind="resource" target={r} queryKeys={[["resource", id], ["resources"]]} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge tone="accent">{RESOURCE_TYPE_LABELS[r.resourceType]}</Badge>
            <Link href={`/subjects/${r.subject.id}`} className="font-medium text-foreground hover:text-accent">
              {r.subject.name}
            </Link>
            {(r.semester ?? r.subject.semester) && (
              <span>· Sem {r.semester ?? r.subject.semester}</span>
            )}
            {r.batchYear && <span>· Batch {r.batchYear}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{r.title}</h1>
          {r.description && (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {r.description}
            </p>
          )}

          <Card className="mt-5 divide-y divide-border text-sm">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted">Source college</span>
              <Link href={`/colleges/${r.college.id}`} className="inline-flex items-center gap-1 font-medium text-foreground hover:text-accent">
                <Building2 className="h-3.5 w-3.5" /> {r.college.name}
                {r.college.location ? ` · ${r.college.location}` : ""}
              </Link>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted">Uploaded by</span>
              <span className="font-medium">{r.uploader.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted">File</span>
              <span>
                {r.resourceType === "link" ? (
                  <a href={r.url ?? "#"} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">
                    {r.url}
                  </a>
                ) : (
                  <>
                    {r.originalFilename ?? "document.pdf"}
                    {r.fileSize ? ` · ${formatBytes(r.fileSize)}` : ""}
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted">Visibility</span>
              <span className="capitalize">{r.visibility === "campus" ? "All campuses" : r.visibility === "college" ? "College only" : "Restricted"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted">Uploaded</span>
              <span>{timeAgo(r.createdAt)}</span>
            </div>
          </Card>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {r.resourceType === "link" && r.url ? (
              <a href={`/api/v1/resources/${r.id}/download`}>
                <Button>
                  <Download className="h-4 w-4" /> Open link
                </Button>
              </a>
            ) : (
              <a href={`/api/v1/resources/${r.id}/download`}>
                <Button>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (!isAuthenticated) {
                  window.location.href = "/auth/sign-in";
                  return;
                }
                bookmarkMutation.mutate(r);
              }}
            >
              <Bookmark className={clsx("h-4 w-4", r.bookmarked && "fill-accent text-accent")} />
              {r.bookmarked ? "Saved" : "Save"}
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() => {
                  if (confirm("Delete this resource? This cannot be undone.")) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            Downloads require a CampusIQ account. Resources are shared by students
            for academic use.
          </p>
        </div>
      </div>

      <ReviewSection resourceId={id} />
    </div>
  );
}
