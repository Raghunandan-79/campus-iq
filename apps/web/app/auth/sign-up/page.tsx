"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, type College, type ListResponse, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/field";

export default function SignUpPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: colleges } = useQuery({
    queryKey: ["colleges", "signup-options"],
    queryFn: () => api.get<ListResponse<College>>("/colleges?pageSize=100"),
    staleTime: 300_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ data: { user: User } }>("/auth/signup", {
        name,
        email,
        password,
        collegeId: collegeId || null,
      }),
    onSuccess: async () => {
      await refresh();
      router.push("/dashboard");
    },
    onError: (e) => {
      setError(e instanceof ApiError ? e.message : "Sign up failed");
    },
  });

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">
        Join students from colleges across CampusIQ.
      </p>
      <Card className="mt-6 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
          </div>
          <div>
            <Label htmlFor="college">College (optional)</Label>
            <Select id="college" value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
              <option value="">Select your college…</option>
              {(colleges?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
