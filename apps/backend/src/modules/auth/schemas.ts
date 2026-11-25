import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(128),
  collegeId: z.string().uuid().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  collegeId: z.string().uuid().nullable().optional(),
});
