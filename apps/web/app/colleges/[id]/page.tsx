"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Flag } from "lucide-react";
import {
  api,
  ApiError,
  type College,
  type CollegeReview,
  type ListResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { RatingSummary, Stars } from "@/components/rating-stars";
import { ResourceCard } from "@/components/resource-card";
import type { ResourceListItem } from "@/lib/api";

const CATEGORIES = [
  ["academicsRating", "Academics"],
  ["facultyRating", "Faculty"],
  ["infrastructureRating", "Infrastructure"],
  ["campusLifeRating", "Campus Life"],
  ["placementsRating", "Placements"],
  ["administrationRating", "Administration"],
] as const;

const emptyForm = {
  overallRating: 0,
  academicsRating: 0,
  facultyRating: 0,
  infrastructureRating: 0,
  campusLifeRating: 0,
  placementsRating: 0,
  administrationRating: 0,
  content: "",
};

function ReviewForm({
  collegeId,
  existing,
}: {
  collegeId: string;
  existing?: CollegeReview;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    ...emptyForm,
    ...(existing ?? {}),
    content: existing?.content ?? "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        overallRating: form.overallRating,
        academicsRating: form.academicsRating,
        facultyRating: form.facultyRating,
        infrastructureRating: form.infrastructureRating,
        campusLifeRating: form.campusLifeRating,
        placementsRating: form.placementsRating,
        administrationRating: form.administrationRating,
        content: form.content || null,
      };
      return existing
        ? api.patch(`/college-reviews/${existing.id}`, body)
        : api.post(`/colleges/${collegeId}/reviews`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["college", collegeId] });
      qc.invalidateQueries({ queryKey: ["college-reviews", collegeId] });
      setError(null);
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : "Failed to save review");
    },
  });

  const set = (k: keyof typeof form, v: number | string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.overallRating >= 1 &&
    form.academicsRating >= 1 &&
    form.facultyRating >= 1 &&
    form.infrastructureRating >= 1 &&
    form.campusLifeRating >= 1 &&
    form.placementsRating >= 1 &&
    form.administrationRating >= 1;

  if (!user) {
    return (
      <Card className="p-5 text-sm text-muted">
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>{" "}
        to write a review for this college.
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold">{existing ? "Edit your review" : "Write a review"}</h3>
      <p className="mt-1 text-xs text-muted">
        Reviews reflect individual student experiences — not verified institutional statements.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Overall rating</Label>
          <Stars value={form.overallRating} onChange={(v) => set("overallRating", v)} size="lg" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {CATEGORIES.map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Stars
                value={form[key]}
                onChange={(v) => set(key, v)}
                size="sm"
              />
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="cr-content">Your review (optional)</Label>
          <Textarea
            id="cr-content"
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="Academics, faculty, infrastructure, campus life, placements…"
            className="min-h-24"
            maxLength={5000}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
          {existing ? "Update review" : "Post review"}
        </Button>
      </div>
    </Card>
  );
}

function CollegeReviewItem({ review, collegeId }: { review: CollegeReview; collegeId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [reported, setReported] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/college-reviews/${review.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["college-reviews", collegeId] }),
  });
  const reportMutation = useMutation({
    mutationFn: () =>
      api.post(`/college-reviews/${review.id}/report`, {
        reason: "Inappropriate or abusive content",
      }),
    onSuccess: () => setReported(true),
  });

  const isOwner = user?.id === review.userId;
  const isMod = user?.role === "moderator" || user?.role === "admin";

  if (editing && isOwner) {
    return (
      <ReviewForm collegeId={collegeId} existing={review} />
    );
  }

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{review.author.name}</span>
        <RatingSummary avg={review.overallRating} />
        <span className="text-xs text-muted">{timeAgo(review.createdAt)}</span>
      </div>
      {review.content && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {review.content}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {CATEGORIES.map(([key, label]) => (
          <span key={key} className="text-muted">
            {label}: <span className="font-medium text-foreground">{review[key]}</span>/5
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {isOwner && (
          <>
            <button className="text-xs text-muted hover:text-foreground" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="text-xs text-muted hover:text-danger"
              onClick={() => {
                if (confirm("Delete your review?")) deleteMutation.mutate();
              }}
            >
              Delete
            </button>
          </>
        )}
        {!isOwner && !reported && (
          <button
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
            onClick={() => reportMutation.mutate()}
          >
            <Flag className="h-3 w-3" /> Report
          </button>
        )}
        {reported && <span className="text-xs text-muted">Reported</span>}
        {isMod && !isOwner && (
          <button
            className="text-xs text-muted hover:text-danger"
            onClick={() => {
              if (confirm("Remove this review as moderator?")) deleteMutation.mutate();
            }}
          >
            Remove (mod)
          </button>
        )}
      </div>
    </div>
  );
}

export default function CollegeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["college", id],
    queryFn: () => api.get<{ data: { college: College } }>(`/colleges/${id}`),
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ["college-reviews", id, "newest", 1],
    queryFn: () =>
      api.get<ListResponse<CollegeReview>>(`/colleges/${id}/reviews?sort=newest&pageSize=20`),
  });

  const { data: resourcesData } = useQuery({
    queryKey: ["resources", "college", id],
    queryFn: () =>
      api.get<ListResponse<ResourceListItem>>(`/resources?collegeId=${id}&pageSize=6`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ErrorState message="College not found." />
      </div>
    );
  }

  const c = data.data.college;
  const myReview = reviewsData?.data.find((r) => r.userId === user?.id);
  const resources = resourcesData?.data ?? [];

  const collegeAny = c as unknown as Record<string, unknown>;
  const catAvg = (key: string) => collegeAny[key] as number | null | undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/colleges" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All colleges
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="break-words text-2xl font-bold tracking-tight">{c.name}</h1>
          {c.location && <p className="mt-1 break-words text-sm text-muted">{c.location}</p>}
          {c.website && (
            <a
              href={c.website}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-sm text-accent hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {c.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {c.description && (
            <p className="mt-3 max-w-2xl break-words text-sm leading-relaxed text-muted">{c.description}</p>
          )}
        </div>
        <Card className="px-5 py-4 text-center">
          <div className="text-3xl font-bold tabular-nums">
            {c.avgOverall ? c.avgOverall.toFixed(1) : "—"}
          </div>
          <div className="mt-1"><RatingSummary avg={c.avgOverall} count={c.reviewCount} /></div>
          <p className="mt-1 text-xs text-muted">{c.reviewCount ?? 0} reviews</p>
        </Card>
      </div>

      {/* Category ratings */}
      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Category ratings</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2.5 sm:grid-cols-3">
          {CATEGORIES.map(([key, label]) => {
            const avg = catAvg(key);
            return (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-semibold tabular-nums">
                  {avg ? `${avg.toFixed(1)}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        {(c.memberCount !== undefined || (c.resourceCount ?? 0) > 0) && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-sm text-muted">
            {c.memberCount !== undefined && <span>{c.memberCount} CampusIQ members</span>}
            {(c.resourceCount ?? 0) > 0 && <span>{c.resourceCount} resources shared</span>}
          </div>
        )}
      </Card>

      {/* Resources from this college */}
      {resources.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Resources from {c.name}</h2>
          <div className="space-y-3">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Student reviews</h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="px-5">
            {reviewsLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : !reviewsData || reviewsData.data.length === 0 ? (
              <EmptyState title="No reviews yet" description="Be the first to review this college." />
            ) : (
              reviewsData.data.map((r) => (
                <CollegeReviewItem key={r.id} review={r} collegeId={id} />
              ))
            )}
          </Card>
          <div>
            <ReviewForm collegeId={id} existing={myReview} />
            {myReview && (
              <p className="mt-2 text-xs text-muted">
                You can only have one active review per college. Editing updates your existing review.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
