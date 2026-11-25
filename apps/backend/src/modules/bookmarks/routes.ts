import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  bookmarks,
  colleges,
  resources,
  subjects,
  users,
} from "../../db/schema";
import {
  resourceDownSql,
  resourceScoreSql,
  resourceUpSql,
} from "../resources/routes";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/common";
import { ok } from "../../utils/http";
import { toCardItems, type CardRow } from "../users/routes";

const router = Router();

const cardSelect = {
  resource: resources,
  subjectName: subjects.name,
  subjectCode: subjects.code,
  semester: subjects.semester,
  collegeName: colleges.name,
  collegeLocation: colleges.location,
  uploaderName: users.name,
  score: resourceScoreSql,
  upvotes: resourceUpSql,
  downvotes: resourceDownSql,
  bookmarkedAt: bookmarks.createdAt,
} as const;

// GET /api/v1/bookmarks — the current user's bookmarked resources.
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = (await db
      .select(cardSelect)
      .from(bookmarks)
      .innerJoin(resources, eq(bookmarks.resourceId, resources.id))
      .innerJoin(subjects, eq(resources.subjectId, subjects.id))
      .innerJoin(colleges, eq(resources.collegeId, colleges.id))
      .innerJoin(users, eq(resources.uploadedBy, users.id))
      .where(
        and(
          eq(bookmarks.userId, req.user!.id),
          eq(resources.uploadStatus, "ready"),
          sql`${resources.moderationStatus} != 'removed'`,
        ),
      )
      .orderBy(desc(bookmarks.createdAt))
      .limit(100)) as (CardRow & { bookmarkedAt: Date })[];
    const items = await toCardItems(
      rows,
      req.user!.id,
      new Set(rows.map((r) => r.resource.id)),
    );
    ok(res, {
      bookmarks: items.map((item, i) => ({
        ...item,
        bookmarkedAt: rows[i]!.bookmarkedAt,
      })),
    });
  }),
);

export default router;
