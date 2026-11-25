"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, UploadCloud } from "lucide-react";
import {
  api,
  ApiError,
  RESOURCE_TYPE_LABELS,
  type College,
  type ListResponse,
  type ResourceType,
  type Subject,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";

function UploadForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("notes");
  const [subjectId, setSubjectId] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [visibility, setVisibility] = useState<"campus" | "college" | "restricted">("campus");
  const [batchYear, setBatchYear] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const { data: subjects } = useQuery({
    queryKey: ["subjects", "upload-options"],
    queryFn: () => api.get<ListResponse<Subject>>("/subjects?pageSize=100"),
  });
  const { data: colleges } = useQuery({
    queryKey: ["colleges", "upload-options"],
    queryFn: () => api.get<ListResponse<College>>("/colleges?pageSize=100"),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const isLink = resourceType === "link";
      if (!isLink && !file) throw new Error("Choose a PDF file first");
      const form = new FormData();
      if (file) form.append("file", file);
      form.append("title", title);
      form.append("resourceType", resourceType);
      form.append("subjectId", subjectId);
      if (description) form.append("description", description);
      if (collegeId) form.append("collegeId", collegeId);
      if (batchYear) form.append("batchYear", batchYear);
      if (isLink && url) form.append("url", url);
      form.append("visibility", visibility);
      return api.post<{ data: { resource: { id: string } } }>(
        "/resources",
        undefined,
        form,
      );
    },
    onMutate: () => {
      setProgress(10);
      const timer = setInterval(() => {
        setProgress((p) => (p == null ? null : Math.min(90, p + 15)));
      }, 400);
      return { timer };
    },
    onSuccess: (res) => {
      setProgress(100);
      setDone(true);
      qc.invalidateQueries({ queryKey: ["resources"] });
      setTimeout(() => router.push(`/resources/${res.data.resource.id}`), 1200);
    },
    onError: (e, _v, ctx) => {
      if (ctx?.timer) clearInterval(ctx.timer);
      setProgress(null);
      setError(e instanceof ApiError ? e.message : "Upload failed. Please try again.");
    },
  });

  const isLink = resourceType === "link";
  const valid =
    title.trim().length >= 3 &&
    subjectId &&
    (isLink ? /^https?:\/\/.+/.test(url) : !!file && file.name.toLowerCase().endsWith(".pdf"));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Share a resource</h1>
      <p className="mt-1 text-sm text-muted">
        Upload a PDF to help students across CampusIQ. PDFs only, max 20 MB.
      </p>

      {done ? (
        <Card className="mt-6 flex flex-col items-center p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <h2 className="mt-3 text-lg font-semibold">Resource shared!</h2>
          <p className="mt-1 text-sm text-muted">Redirecting to your resource…</p>
        </Card>
      ) : (
        <Card className="mt-6 space-y-5 p-6">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DBMS Unit 3 Notes — B+Tree & Indexing"
              maxLength={300}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Resource type</Label>
              <Select id="type" value={resourceType} onChange={(e) => setResourceType(e.target.value as ResourceType)}>
                {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="batch">Batch year (optional)</Label>
              <Select id="batch" value={batchYear} onChange={(e) => setBatchYear(e.target.value)}>
                <option value="">Any batch</option>
                {Array.from({ length: 8 }, (_, i) => 2024 + i).map((y) => (
                  <option key={y} value={y}>Batch {y}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Select id="subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select subject…</option>
                {(subjects?.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.semester ? ` (Sem ${s.semester})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="college">Source college</Label>
            <Select id="college" value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>
              <option value="">{user?.collegeId ? "My college (default)" : "Select college…"}</option>
              {(colleges?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">
              Attribution shown on the resource. Defaults to your affiliated college.
            </p>
          </div>

          <div>
            <Label htmlFor="visibility">Visibility</Label>
            <Select id="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
              <option value="campus">All campuses (recommended)</option>
              <option value="college">My college only</option>
              <option value="restricted">Restricted</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's inside? Which units/topics does it cover?"
              maxLength={5000}
            />
          </div>

          {isLink ? (
            <div>
              <Label htmlFor="url">Link URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/… or any useful link"
              />
              <p className="mt-1 text-xs text-muted">
                Share a useful external link (Drive, docs, article) instead of a file.
              </p>
            </div>
          ) : (
          <div>
            <Label>PDF file</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface/50 px-4 py-8 text-center transition-colors hover:border-accent"
            >
              <UploadCloud className="h-8 w-8 text-muted" />
              <span className="mt-2 text-sm font-medium text-foreground">
                {file ? file.name : "Choose a PDF to upload"}
              </span>
              <span className="mt-1 text-xs text-muted">
                {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PDF only · max 20 MB"}
              </span>
            </button>
            {file && !file.name.toLowerCase().endsWith(".pdf") && (
              <FieldError>Only PDF files are supported.</FieldError>
            )}
          </div>
          )}

          {progress !== null && (
            <div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                {progress >= 100 ? "Done" : "Uploading…"} {progress}%
              </p>
            </div>
          )}

          {error && <FieldError>{error}</FieldError>}

          <Button
            className="w-full"
            size="lg"
            disabled={!valid || mutation.isPending || done}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            <FileUp className="h-4 w-4" />
            {mutation.isPending ? "Uploading…" : "Share resource"}
          </Button>
        </Card>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadForm />
    </RequireAuth>
  );
}
