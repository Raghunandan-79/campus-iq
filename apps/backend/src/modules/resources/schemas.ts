import { z } from "zod";

export const resourceTypeSchema = z.enum([
  "notes",
  "pyq",
  "syllabus",
  "revision",
  "solved",
  "link",
  "other",
]);

export const listResourcesQuery = z.object({
  q: z.string().trim().max(200).optional(),
  subjectId: z.string().uuid().optional(),
  collegeId: z.string().uuid().optional(),
  resourceType: resourceTypeSchema.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  batchYear: z.coerce.number().int().min(2000).max(2100).optional(),
  sort: z.enum(["newest", "top", "downloads"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const uploadMetaSchema = z.object({
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().max(5000).optional().nullable(),
  resourceType: resourceTypeSchema,
  subjectId: z.string().uuid().optional().nullable(),
  subjectName: z.string().trim().min(2).max(200).optional().nullable(),
  collegeId: z.string().uuid().optional().nullable(),
  visibility: z.enum(["campus", "college", "restricted"]).default("campus"),
  batchYear: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
  semester: z.coerce.number().int().min(1).max(12).optional().nullable(),
  url: z.string().trim().url().max(1000).optional().nullable(),
}).refine((v) => v.subjectId || v.subjectName, {
  message: "subjectId or subjectName is required",
});

export const voteSchema = z.object({
  vote_type: z.enum(["upvote", "downvote"]),
});

export const createReviewSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  parentReviewId: z.string().uuid().optional().nullable(),
});

export const updateReviewSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const listReviewsQuery = z.object({
  sort: z.enum(["best", "top", "newest", "oldest"]).default("best"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
