"use client";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const BASE = "/api/v1";

async function request<T>(
  path: string,
  options: RequestInit & { json?: unknown; form?: FormData } = {},
): Promise<T> {
  const { json, form, headers, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
  });

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "error",
      err.message ?? `Request failed (${res.status})`,
      err.details,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, json?: unknown, form?: FormData) =>
    request<T>(path, { method: "POST", json, form }),
  patch: <T>(path: string, json: unknown) =>
    request<T>(path, { method: "PATCH", json }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ---------- shared types ----------

export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "moderator" | "admin";
  collegeId: string | null;
  createdAt?: string;
}

export interface College {
  id: string;
  name: string;
  domain: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  reviewCount?: number;
  avgOverall?: number | null;
  resourceCount?: number;
  memberCount?: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  semester: number | null;
  description: string | null;
  collegeId: string | null;
  collegeName?: string | null;
}

export type ResourceType =
  | "notes"
  | "pyq"
  | "syllabus"
  | "revision"
  | "solved"
  | "link"
  | "other";

export interface CollegeRequest {
  id: string;
  name: string;
  location: string | null;
  website: string | null;
  status: "pending" | "approved" | "dismissed";
  createdAt: string;
  requester?: { name: string; email: string };
  createdCollegeName?: string | null;
}

export interface ResourceListItem {
  id: string;
  title: string;
  description: string | null;
  resourceType: ResourceType;
  subjectId: string;
  collegeId: string;
  uploadedBy: string;
  originalFilename: string | null;
  mimeType: string | null;
  fileSize: number | null;
  url: string | null;
  batchYear: number | null;
  semester: number | null;
  visibility: string;
  downloadCount: number;
  createdAt: string;
  subject: { id: string; name: string; code: string | null; semester: number | null };
  college: { id: string; name: string; location: string | null };
  uploader: { name: string };
  score: number;
  upvotes: number;
  downvotes: number;
  userVote: "upvote" | "downvote" | null;
  bookmarked: boolean;
}

export interface ResourceDetail extends Omit<ResourceListItem, "uploader"> {
  uploader: { name: string; collegeId: string | null };
  reviewCount: number;
}

export interface ReviewAuthor {
  name: string;
  collegeId: string | null;
}

export interface ResourceReview {
  id: string;
  resourceId: string;
  userId: string;
  parentReviewId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor;
  score: number;
  upvotes: number;
  userVote: "upvote" | "downvote" | null;
  replies: ResourceReview[];
}

export interface CollegeReview {
  id: string;
  collegeId: string;
  userId: string;
  overallRating: number;
  academicsRating: number;
  facultyRating: number;
  infrastructureRating: number;
  campusLifeRating: number;
  placementsRating: number;
  administrationRating: number;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface SingleResponse<T> {
  data: T;
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  notes: "Notes",
  pyq: "PYQ",
  syllabus: "Syllabus",
  revision: "Revision",
  solved: "Solved",
  link: "Link",
  other: "Other",
};
