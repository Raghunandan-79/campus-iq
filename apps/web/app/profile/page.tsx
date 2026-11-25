"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Save } from "lucide-react";
import {
  api,
  ApiError,
  type College,
  type ListResponse,
  type User as UserType,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { ResourceCard } from "@/components/resource-card";
import type { ResourceListItem } from "@/lib/api";
import { formatBytes } from "@/lib/format";

interface ProfileUser extends UserType {
  collegeName?: string | null;
  collegeLocation?: string | null;
}

function ProfileContent() {
  const { user: authUser, logout } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [collegeId, setCollegeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get<{ data: { user: ProfileUser } }>("/users/me"),
  });
  const user = me?.data.user;
  const displayName = name ?? user?.name ?? "";
  const displayCollege = collegeId ?? user?.collegeId ?? "";

  const { data: colleges } = useQuery({
    queryKey: ["colleges", "profile-options"],
    queryFn: () => api.get<ListResponse<College>>("/colleges?pageSize=100"),
  });

  const { data: mine } = useQuery({
    queryKey: ["my-resources"],
    queryFn: () =>
      api.get<{ data: { resources: ResourceListItem[] } }>("/users/me/resources"),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch("/users/me", {
        name: displayName,
        collegeId: displayCollege || null,
      }),
    onSuccess: async () => {
      setSaved(true);
      setError(null);
      setName(null);
      setCollegeId(null);
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["me-profile"] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : "Failed to save");
      setSaved(false);
    },
  });

  const resources = mine?.data.resources ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted">Your account and contributions.</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-white">
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-muted">{user?.email}</div>
            <div className="mt-0.5 text-xs text-muted capitalize">
              {user?.role} · joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-name">Display name</Label>
            <Input
              id="p-name"
              value={displayName}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div>
            <Label htmlFor="p-college">College</Label>
            <Select
              id="p-college"
              value={displayCollege}
              onChange={(e) => {
                setCollegeId(e.target.value);
                setSaved(false);
              }}
            >
              <option value="">No college</option>
              {(colleges?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>

        {error && <FieldError>{error}</FieldError>}
        <div className="mt-4 flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!name && collegeId === null)}
          >
            <Save className="h-4 w-4" /> {saved ? "Saved" : "Save changes"}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Your uploads ({resources.length})</h2>
        {resources.length === 0 ? (
          <EmptyState title="No uploads yet" description="Resources you share will appear here." />
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

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
