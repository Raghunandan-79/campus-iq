import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { bookmarks, colleges, resources, subjects } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/common";
import { ok } from "../../utils/http";

const router = Router();

// GET /api/v1/bookmarks — the current user's bookmarked resources.
router.get(
  "/",
  requireAuth,
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

export default router;
