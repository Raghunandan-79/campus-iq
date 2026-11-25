import { Router } from "express";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  bookmarks,
  colleges,
  resourceReviews,
  resourceVotes,
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

const resourceCardSelect = {
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
} as const;

export type CardRow = {
  resource: typeof resources.$inferSelect;
  subjectName: string;
  subjectCode: string | null;
  semester: number | null;
  collegeName: string;
  collegeLocation: string | null;
  uploaderName: string;
  score: number;
  upvotes: number;
  downvotes: number;
};

export async function toCardItems(rows: CardRow[], userId: string, bookmarkedIds?: Set<string>) {
  const db = await getDb();
  const ids = rows.map((r) => r.resource.id);
  const userVotes = new Map<string, string>();
  let userBookmarks = bookmarkedIds ?? new Set<string>();
  if (ids.length > 0) {
    const votes = await db
      .select()
      .from(resourceVotes)
      .where(
        and(
          eq(resourceVotes.userId, userId),
          sql`${resourceVotes.resourceId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`,
        ),
      );
    for (const v of votes) userVotes.set(v.resourceId, v.voteType);
    if (!bookmarkedIds) {
      const bms = await db
        .select({ resourceId: bookmarks.resourceId })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, userId),
            sql`${bookmarks.resourceId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`,
          ),
        );
      userBookmarks = new Set(bms.map((b) => b.resourceId));
    }
  }
  return rows.map((r) => ({
    ...r.resource,
    subject: {
      id: r.resource.subjectId,
      name: r.subjectName,
      code: r.subjectCode,
      semester: r.semester,
    },
    college: {
      id: r.resource.collegeId,
      name: r.collegeName,
      location: r.collegeLocation,
    },
    uploader: { name: r.uploaderName },
    score: Number(r.score),
    upvotes: Number(r.upvotes),
    downvotes: Number(r.downvotes),
    userVote: (userVotes.get(r.resource.id) as "upvote" | "downvote" | undefined) ?? null,
    bookmarked: userBookmarks.has(r.resource.id),
  }));
}

router.get(
  "/me/resources",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = (await db
      .select(resourceCardSelect)
      .from(resources)
      .innerJoin(subjects, eq(resources.subjectId, subjects.id))
      .innerJoin(colleges, eq(resources.collegeId, colleges.id))
      .innerJoin(users, eq(resources.uploadedBy, users.id))
      .where(eq(resources.uploadedBy, req.user!.id))
      .orderBy(desc(resources.createdAt))
      .limit(100)) as CardRow[];
    ok(res, { resources: await toCardItems(rows, req.user!.id) });
  }),
);

router.get(
  "/me/bookmarks",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rows = (await db
      .select({
        ...resourceCardSelect,
        bookmarkedAt: bookmarks.createdAt,
      })
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
