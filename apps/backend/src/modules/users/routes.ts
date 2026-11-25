import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  bookmarks,
  colleges,
  resourceReviews,
  resources,
  subjects,
  users,
} from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import {
  asyncHandler,
  validateBody,
} from "../../middleware/common";
import { notFound } from "../../utils/errors";
import { ok, okList } from "../../utils/http";
import { updateProfileSchema } from "../auth/schemas";

const router = Router();

router.use(requireAuth);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        collegeId: users.collegeId,
        createdAt: users.createdAt,
        collegeName: colleges.name,
        collegeLocation: colleges.location,
      })
      .from(users)
      .leftJoin(colleges, eq(users.collegeId, colleges.id))
      .where(eq(users.id, req.user!.id))
      .limit(1);
    if (!user) return next404(res);
    ok(res, { user });
  }),
);

function next404(res: import("express").Response) {
  res.status(404).json({ error: { code: "not_found", message: "Not found" } });
}

router.patch(
  "/me",
  validateBody(updateProfileSchema),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const body = req.body as z.infer<typeof updateProfileSchema>;
    if (body.collegeId) {
      const [c] = await db
        .select({ id: colleges.id })
        .from(colleges)
        .where(eq(colleges.id, body.collegeId))
        .limit(1);
      if (!c) return next(notFound("College not found"));
    }
    const [updated] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        collegeId: users.collegeId,
      });
    ok(res, { user: updated });
  }),
);

router.get(
  "/me/resources",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        resource: resources,
        subjectName: subjects.name,
        collegeName: colleges.name,
        downloadCount: resources.downloadCount,
      })
      .from(resources)
      .innerJoin(subjects, eq(resources.subjectId, subjects.id))
      .innerJoin(colleges, eq(resources.collegeId, colleges.id))
      .where(eq(resources.uploadedBy, req.user!.id))
      .orderBy(desc(resources.createdAt))
      .limit(100);
    ok(res, {
      resources: rows.map((r) => ({
        ...r.resource,
        subjectName: r.subjectName,
        collegeName: r.collegeName,
      })),
    });
  }),
);

router.get(
  "/me/bookmarks",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({
        bookmark: bookmarks,
        resource: resources,
        subjectName: subjects.name,
        collegeName: colleges.name,
      })
      .from(bookmarks)
      .innerJoin(resources, eq(bookmarks.resourceId, resources.id))
      .innerJoin(subjects, eq(resources.subjectId, subjects.id))
      .innerJoin(colleges, eq(resources.collegeId, colleges.id))
      .where(
        and(
          eq(bookmarks.userId, req.user!.id),
          eq(resources.uploadStatus, "ready"),
          sql`${resources.moderationStatus} != 'removed'`,
        ),
      )
      .orderBy(desc(bookmarks.createdAt))
      .limit(100);
    ok(res, {
      bookmarks: rows.map((r) => ({
        ...r.resource,
        bookmarkedAt: r.bookmark.createdAt,
        subjectName: r.subjectName,
        collegeName: r.collegeName,
      })),
    });
  }),
);

router.get(
  "/me/reviews",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = await db
      .select({ review: resourceReviews, resourceTitle: resources.title })
      .from(resourceReviews)
      .innerJoin(resources, eq(resourceReviews.resourceId, resources.id))
      .where(eq(resourceReviews.userId, req.user!.id))
      .orderBy(desc(resourceReviews.createdAt))
      .limit(100);
    ok(res, { reviews: rows });
  }),
);

export default router;
