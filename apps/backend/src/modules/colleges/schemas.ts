import { z } from "zod";

export const listCollegesQuery = z.object({
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const rating = z.number().int().min(1).max(5);

export const collegeReviewSchema = z.object({
  overallRating: rating,
  academicsRating: rating,
  facultyRating: rating,
  infrastructureRating: rating,
  campusLifeRating: rating,
  placementsRating: rating,
  administrationRating: rating,
  content: z.string().trim().max(5000).optional().nullable(),
});

export const listCollegeReviewsQuery = z.object({
  sort: z.enum(["helpful", "highest", "lowest", "newest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const reportSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z.string().trim().max(50).optional().nullable(),
  semester: z.number().int().min(1).max(12).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  collegeId: z.string().uuid().optional().nullable(),
});
