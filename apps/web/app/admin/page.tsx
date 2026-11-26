"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import {
  api,
  ApiError,
  type College,
  type CollegeRequest,
  type ListResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/require-auth";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { timeAgo } from "@/lib/format";

function AdminContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"requests" | "colleges">("requests");
  const [status, setStatus] = useState<"pending" | "approved" | "dismissed">("pending");
  const [error, setError] = useState<string | null>(null);

  // New college form
  const [cName, setCName] = useState("");
  const [cDomain, setCDomain] = useState("");
  const [cLocation, setCLocation] = useState("");
  const [cWebsite, setCWebsite] = useState("");

  const { data: requests, isLoading: reqLoading } = useQuery({
    queryKey: ["admin", "college-requests", status],
    queryFn: () =>
      api.get<ListResponse<CollegeRequest>>(
        `/admin/college-requests?status=${status}&pageSize=100`,
      ),
    enabled: tab === "requests",
  });

  const { data: colleges, isLoading: colLoading } = useQuery({
    queryKey: ["admin", "colleges"],
    queryFn: () => api.get<ListResponse<College>>("/admin/colleges"),
    enabled: tab === "colleges",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["colleges"] });
  };

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/college-requests/${id}/approve`, {}),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Approve failed"),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api.post(`/admin/college-requests/${id}/dismiss`, {}),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Dismiss failed"),
  });
  const addCollege = useMutation({
    mutationFn: () =>
      api.post("/admin/colleges", {
        name: cName,
        domain: cDomain || null,
        location: cLocation || null,
        website: cWebsite || null,
      }),
    onSuccess: () => {
      invalidate();
      setCName(""); setCDomain(""); setCLocation(""); setCWebsite("");
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Failed to add college"),
  });

  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState title="Admins only" description="This area is restricted to administrators." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Admin portal</h1>
      <p className="mt-1 text-sm text-muted">
        Manage college requests and the college directory.
      </p>

      <div className="mt-6 flex gap-2">
        {(["requests", "colleges"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            {t === "requests" ? "College requests" : "Colleges"}
          </button>
        ))}
      </div>

      {error && <FieldError>{error}</FieldError>}

      {tab === "requests" && (
        <div className="mt-4">
          <div className="mb-3 flex items-center gap-3">
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-40">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="dismissed">Dismissed</option>
            </Select>
          </div>
          {reqLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : !requests || requests.data.length === 0 ? (
            <EmptyState title="No requests" description={`No ${status} college requests.`} />
          ) : (
            <div className="space-y-3">
              {requests.data.map((r) => (
                <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="mt-0.5 text-sm text-muted">
                      {[r.location, r.website].filter(Boolean).join(" · ") || "No details"}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      Requested by {r.requester?.name} ({r.requester?.email}) · {timeAgo(r.createdAt)}
                      {r.createdCollegeName ? ` · → ${r.createdCollegeName}` : ""}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(r.id)}>
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={dismiss.isPending} onClick={() => dismiss.mutate(r.id)}>
                        <X className="h-4 w-4" /> Dismiss
                      </Button>
                    </div>
                  )}
                  {r.status !== "pending" && <Badge>{r.status}</Badge>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "colleges" && (
        <div className="mt-4 space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Add a college</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ac-name">Name</Label>
                <Input id="ac-name" value={cName} onChange={(e) => setCName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ac-domain">Email domain (optional)</Label>
                <Input id="ac-domain" value={cDomain} onChange={(e) => setCDomain(e.target.value)} placeholder="college.edu" />
              </div>
              <div>
                <Label htmlFor="ac-loc">Location</Label>
                <Input id="ac-loc" value={cLocation} onChange={(e) => setCLocation(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ac-web">Website</Label>
                <Input id="ac-web" type="url" value={cWebsite} onChange={(e) => setCWebsite(e.target.value)} placeholder="https://…" />
              </div>
            </div>
            <Button size="sm" className="mt-4" disabled={cName.trim().length < 2 || addCollege.isPending} onClick={() => addCollege.mutate()}>
              <Plus className="h-4 w-4" /> Add college
            </Button>
          </Card>

          {colLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <Card className="divide-y divide-border">
              {(colleges?.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 break-all text-muted">{[c.location, c.domain].filter(Boolean).join(" · ")}</span>
                  </div>
                  {c.website && (
                    <a href={c.website} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Website
                    </a>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}
