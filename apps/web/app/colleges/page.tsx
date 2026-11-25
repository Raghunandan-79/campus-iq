"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api, ApiError, type College, type ListResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/field";
import { RatingSummary } from "@/components/rating-stars";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 24;

function RequestCollegeForm() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/colleges/request", {
        name,
        location: location || null,
        website: website || null,
      }),
    onSuccess: () => {
      setDone(true);
      setError(null);
      setName("");
      setLocation("");
      setWebsite("");
      setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 2000);
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Request failed"),
  });

  if (!isAuthenticated) {
    return (
      <p className="mt-3 text-sm text-muted">
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>{" "}
        to request your college.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        className="text-sm font-medium text-accent hover:underline"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Cancel" : "Can't find your college? Request it →"}
      </button>
      {open && (
        <Card className="mt-3 max-w-lg space-y-3 p-4">
          <p className="text-sm text-muted">
            An admin will review and add it to the directory.
          </p>
          <div>
            <Label htmlFor="req-name">College name</Label>
            <Input id="req-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Model Institute of Engineering and Technology" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="req-loc">Location</Label>
              <Input id="req-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Jammu, J&K" />
            </div>
            <div>
              <Label htmlFor="req-web">Website (optional)</Label>
              <Input id="req-web" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          {error && <FieldError>{error}</FieldError>}
          {done && <p className="text-sm text-success">Request submitted — thanks!</p>}
          <Button
            size="sm"
            disabled={name.trim().length < 2 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Submit request
          </Button>
        </Card>
      )}
    </div>
  );
}

function CollegesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const location = params.get("location") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [draftQ, setDraftQ] = useState(q);
  const [draftLoc, setDraftLoc] = useState(location);
  useEffect(() => setDraftQ(q), [q]);
  useEffect(() => setDraftLoc(location), [location]);

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (location) qs.set("location", location);
  qs.set("page", String(page));
  qs.set("pageSize", String(PAGE_SIZE));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["colleges", qs.toString()],
    queryFn: () => api.get<ListResponse<College>>(`/colleges?${qs}`),
  });

  const apply = () => {
    const next = new URLSearchParams();
    if (draftQ.trim()) next.set("q", draftQ.trim());
    if (draftLoc.trim()) next.set("location", draftLoc.trim());
    router.push(`/colleges?${next.toString()}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">College directory</h1>
        <p className="mt-1 text-sm text-muted">
          Browse institutions and read reviews from real students.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="mb-6 flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Search colleges…" className="pl-9" />
        </div>
        <Input value={draftLoc} onChange={(e) => setDraftLoc(e.target.value)} placeholder="Location…" className="sm:w-56" />
        <button type="submit" className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
          Search
        </button>
      </form>
      <RequestCollegeForm />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState title="No colleges found" description="Try a different search." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((c) => (
              <Link key={c.id} href={`/colleges/${c.id}`}>
                <Card className="flex h-full flex-col p-4 transition-colors hover:border-accent">
                  <h3 className="font-semibold leading-snug">{c.name}</h3>
                  {c.location && <p className="mt-0.5 text-sm text-muted">{c.location}</p>}
                  <div className="mt-auto pt-3">
                    <RatingSummary avg={c.avgOverall} count={c.reviewCount} />
                    {c.resourceCount !== undefined && c.resourceCount > 0 && (
                      <p className="mt-1 text-xs text-muted">
                        {c.resourceCount} resource{c.resourceCount === 1 ? "" : "s"} shared
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={data.pagination.total}
            onPage={(p) => {
              const next = new URLSearchParams(qs.toString());
              next.set("page", String(p));
              router.push(`/colleges?${next.toString()}`);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function CollegesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><Skeleton className="h-96 w-full" /></div>}>
      <CollegesInner />
    </Suspense>
  );
}
