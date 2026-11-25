import { Router } from "express";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import {
  bookmarks,
  colleges,
  moderationLogs,
  reports,
  resourceReviews,
  resources,
  resourceVotes,
  reviewVotes,
  subjects,
  users,
} from "../../db/schema";
import type { AuthUser } from "../../middleware/auth";
import { optionalAuth, requireAuth, requireModerator } from "../../middleware/auth";
import {
  asyncHandler,
  validateBody,
  validateQuery,
} from "../../middleware/common";
import { getStorage } from "../../storage";
import {
  badRequest,
  forbidden,
  notFound,
} from "../../utils/errors";
import { fail, ok, okList } from "../../utils/http";
import { reportSchema } from "../colleges/schemas";
import {
  createReviewSchema,
  listResourcesQuery,
  listReviewsQuery,
  updateReviewSchema,
  uploadMetaSchema,
  voteSchema,
} from "./schemas";
import {
  bufferToStream,
  generateStorageKey,
  uploadSingle,
  validateFileContent,
} from "./upload";

const router = Router();

// ---------- visibility ----------

function visibilityCondition(user: AuthUser | undefined): SQL | undefined {
  const campusOnly = eq(resources.visibility, "campus");
  if (!user) return campusOnly;
  const isStaff = user.role === "moderator" || user.role === "admin";
  const own = eq(resources.uploadedBy, user.id);
  const sameCollege =
    user.collegeId != null
      ? and(
          eq(resources.visibility, "college"),
          eq(resources.collegeId, user.collegeId),
        )
      : undefined;
  const parts = [campusOnly, own];
  if (sameCollege) parts.push(sameCollege);
  if (isStaff) parts.push(eq(resources.visibility, "restricted"));
  return or(...parts);
}

async function getVisibleResource(id: string, user?: AuthUser) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(resources)
    .where(
      and(
        eq(resources.id, id),
        ne(resources.moderationStatus, "removed"),
        visibilityCondition(user),
      ),
    )
    .limit(1);
  return row ?? null;
}

const resourceScoreSql = sql<number>`coalesce((select sum(case when ${resourceVotes.voteType} = 'upvote' then 1 when ${resourceVotes.voteType} = 'downvote' then -1 else 0 end) from ${resourceVotes} where ${resourceVotes.resourceId} = ${resources.id}), 0)`;
const resourceUpSql = sql<number>`coalesce((select count(*) from ${resourceVotes} where ${resourceVotes.resourceId} = ${resources.id} and ${resourceVotes.voteType} = 'upvote'), 0)`;
const resourceDownSql = sql<number>`coalesce((select count(*) from ${resourceVotes} where ${resourceVotes.resourceId} = ${resources.id} and ${resourceVotes.voteType} = 'downvote'), 0)`;

// ---------- list / search ----------

router.get(
  "/",
  optionalAuth,
  validateQuery(listResourcesQuery),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as z.infer<typeof listResourcesQuery>;
    const user = req.user;
    const db = await getDb();

    const conditions: (SQL | undefined)[] = [
      eq(resources.uploadStatus, "ready"),
      ne(resources.moderationStatus, "removed"),
      visibilityCondition(user),
    ];
    if (q.q) {
      const pattern = `%${q.q}%`;
      conditions.push(
        or(ilike(resources.title, pattern), ilike(resources.description, pattern)),
      );
    }
    if (q.subjectId) conditions.push(eq(resources.subjectId, q.subjectId));
    if (q.collegeId) conditions.push(eq(resources.collegeId, q.collegeId));
    if (q.resourceType) conditions.push(eq(resources.resourceType, q.resourceType));
    if (q.batchYear) conditions.push(eq(resources.batchYear, q.batchYear));

    const selectShape = {
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

    const fullWhere = and(
      ...conditions,
      q.semester
        ? sql`coalesce(${resources.semester}, ${subjects.semester}) = ${q.semester}`
        : undefined,
    );

    const orderBy =
      q.sort === "top"
        ? [desc(resourceScoreSql), desc(resources.createdAt)]
        : q.sort === "downloads"
          ? [desc(resources.downloadCount), desc(resources.createdAt)]
          : [desc(resources.createdAt)];

    const [rows, totalRows] = await Promise.all([
      db
        .select(selectShape)
        .from(resources)
        .innerJoin(subjects, eq(resources.subjectId, subjects.id))
        .innerJoin(colleges, eq(resources.collegeId, colleges.id))
        .innerJoin(users, eq(resources.uploadedBy, users.id))
        .where(fullWhere)
        .orderBy(...orderBy)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db
        .select({ n: count() })
        .from(resources)
        .innerJoin(subjects, eq(resources.subjectId, subjects.id))
        .where(fullWhere),
    ]);

    // Attach viewer-specific vote/bookmark state in batch.
    const ids = rows.map((r) => r.resource.id);
    let userVotes = new Map<string, string>();
    let userBookmarks = new Set<string>();
    if (user && ids.length > 0) {
      const votes = await db
        .select()
        .from(resourceVotes)
        .where(
          and(eq(resourceVotes.userId, user.id), sql`${resourceVotes.resourceId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`),
        );
      userVotes = new Map(votes.map((v) => [v.resourceId, v.voteType]));
      const bms = await db
        .select({ resourceId: bookmarks.resourceId })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userId, user.id),
            sql`${bookmarks.resourceId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`,
          ),
        );
      userBookmarks = new Set(bms.map((b) => b.resourceId));
    }

    okList(
      res,
      rows.map((r) => ({
        ...r.resource,
        subject: { id: r.resource.subjectId, name: r.subjectName, code: r.subjectCode, semester: r.semester },
        college: { id: r.resource.collegeId, name: r.collegeName, location: r.collegeLocation },
        uploader: { name: r.uploaderName },
        score: Number(r.score),
        upvotes: Number(r.upvotes),
        downvotes: Number(r.downvotes),
        userVote: userVotes.get(r.resource.id) ?? null,
        bookmarked: userBookmarks.has(r.resource.id),
      })),
      { page: q.page, pageSize: q.pageSize, total: totalRows[0]?.n ?? 0 },
    );
  }),
);

// ---------- upload ----------

router.post(
  "/",
  requireAuth,
  uploadSingle,
  asyncHandler(async (req, res, next) => {
    const meta = uploadMetaSchema.safeParse(req.body);
    if (!meta.success) {
      return next(badRequest("Validation failed", meta.error.flatten()));
    }
    const m = meta.data;
    const user = req.user!;
    const db = await getDb();
    const isLink = m.resourceType === "link";
    const file = req.file;

    if (isLink) {
      if (!m.url) return next(badRequest("A URL is required for link resources"));
    } else {
      if (!file) return next(badRequest("A file is required"));
      const check = validateFileContent(file.buffer, file.originalname);
      if (!check.ok) return next(badRequest("File content does not match its extension"));
    }

    const collegeId = m.collegeId ?? user.collegeId;
    if (!collegeId) return next(badRequest("A college affiliation is required"));

    const [college] = await db
      .select({ id: colleges.id })
      .from(colleges)
      .where(eq(colleges.id, collegeId))
      .limit(1);
    if (!college) return next(badRequest("Unknown college"));

    let subjectId: string;
    if (m.subjectId) {
      const [subject] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.id, m.subjectId))
        .limit(1);
      if (!subject) return next(badRequest("Unknown subject"));
      subjectId = subject.id;
    } else {
      const name = m.subjectName!.trim();
      const [existing] = await db
        .select({ id: subjects.id })
        .from(subjects)
        .where(ilike(subjects.name, name))
        .limit(1);
      if (existing) {
        subjectId = existing.id;
      } else {
        const [created] = await db
          .insert(subjects)
          .values({ name, collegeId: null })
          .returning({ id: subjects.id });
        subjectId = created!.id;
      }
    }

    let key: string | null = null;
    const storage = getStorage();

    if (!isLink && file) {
      key = generateStorageKey(user.id, file.originalname);
      try {
        await storage.upload({
          key,
          body: bufferToStream(file.buffer),
          contentType: file.mimetype || "application/octet-stream",
          contentLength: file.size,
        });
      } catch (e) {
        return next(
          badRequest(
            "File storage failed; please try again",
          ),
        );
      }
    }

    try {
      const [resource] = await db
        .insert(resources)
        .values({
          title: m.title,
          description: m.description ?? null,
          resourceType: m.resourceType,
          subjectId,
          collegeId,
          uploadedBy: user.id,
          storageKey: key,
          originalFilename: file ? file.originalname.slice(0, 500) : null,
          mimeType: file ? file.mimetype : null,
          fileSize: file ? file.size : null,
          url: isLink ? (m.url ?? null) : null,
          batchYear: m.batchYear ?? null,
          semester: m.semester ?? null,
          visibility: m.visibility,
          uploadStatus: "ready",
        })
        .returning();
      ok(res, { resource });
    } catch (e) {
      // DB write failed after storage succeeded — clean up the object.
      if (key) await storage.delete(key).catch(() => {});
      throw e;
    }
  }),
);

// ---------- detail ----------

router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res, next) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource) return next(notFound("Resource not found"));
    const db = await getDb();
    const [row] = await db
      .select({
        subjectName: subjects.name,
        subjectCode: subjects.code,
        semester: subjects.semester,
        collegeName: colleges.name,
        collegeLocation: colleges.location,
        uploaderName: users.name,
        uploaderCollegeId: users.collegeId,
        score: resourceScoreSql,
        upvotes: resourceUpSql,
        downvotes: resourceDownSql,
        reviewCount: sql<number>`(select count(*) from ${resourceReviews} where ${resourceReviews.resourceId} = ${resources.id} and ${resourceReviews.parentReviewId} is null and ${resourceReviews.moderationStatus} = 'visible')`,
      })
      .from(resources)
      .innerJoin(subjects, eq(resources.subjectId, subjects.id))
      .innerJoin(colleges, eq(resources.collegeId, colleges.id))
      .innerJoin(users, eq(resources.uploadedBy, users.id))
      .where(eq(resources.id, resource.id))
      .limit(1);

    let userVote: string | null = null;
    let bookmarked = false;
    if (req.user) {
      const [v] = await db
        .select({ voteType: resourceVotes.voteType })
        .from(resourceVotes)
        .where(
          and(
            eq(resourceVotes.resourceId, resource.id),
            eq(resourceVotes.userId, req.user.id),
          ),
        )
        .limit(1);
      userVote = v?.voteType ?? null;
      const [b] = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.resourceId, resource.id),
            eq(bookmarks.userId, req.user.id),
          ),
        )
        .limit(1);
      bookmarked = !!b;
    }

    ok(res, {
      resource: {
        ...resource,
        subject: row && {
          id: resource.subjectId,
          name: row.subjectName,
          code: row.subjectCode,
          semester: row.semester,
        },
        college: row && {
          id: resource.collegeId,
          name: row.collegeName,
          location: row.collegeLocation,
        },
        uploader: row && {
          name: row.uploaderName,
          collegeId: row.uploaderCollegeId,
        },
        score: Number(row?.score ?? 0),
        upvotes: Number(row?.upvotes ?? 0),
        downvotes: Number(row?.downvotes ?? 0),
        reviewCount: Number(row?.reviewCount ?? 0),
        userVote,
        bookmarked,
      },
    });
  }),
);

// ---------- download ----------

router.get(
  "/:id/download",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource || resource.uploadStatus !== "ready") {
      return next(notFound("Resource not found"));
    }
    if (resource.resourceType === "link" && resource.url) {
      const db0 = await getDb();
      await db0
        .update(resources)
        .set({ downloadCount: sql`${resources.downloadCount} + 1` })
        .where(eq(resources.id, resource.id));
      return res.redirect(resource.url);
    }
    if (!resource.storageKey) return next(notFound("File is unavailable"));
    const storage = getStorage();
    const exists = await storage.exists(resource.storageKey);
    if (!exists) return next(notFound("File is unavailable"));

    const stream = await storage.download(resource.storageKey);
    const filename =
      resource.originalFilename ??
      `${resource.title.replace(/[^\w\-. ]+/g, "_")}.pdf`;
    res.setHeader("Content-Type", resource.mimeType ?? "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    if (resource.fileSize) {
      res.setHeader("Content-Length", String(resource.fileSize));
    }
    stream.pipe(res);

    const db = await getDb();
    await db
      .update(resources)
      .set({ downloadCount: sql`${resources.downloadCount} + 1` })
      .where(eq(resources.id, resource.id));
  }),
);

// ---------- delete ----------

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, req.params.id!))
      .limit(1);
    if (!resource) return next(notFound("Resource not found"));
    const isOwner = resource.uploadedBy === req.user!.id;
    const isMod = req.user!.role === "moderator" || req.user!.role === "admin";
    if (!isOwner && !isMod) return next(forbidden());

    if (isMod && !isOwner) {
      await db.insert(moderationLogs).values({
        actorId: req.user!.id,
        targetType: "resource",
        targetId: resource.id,
        action: "remove_resource",
      });
    }
    await db.delete(resources).where(eq(resources.id, resource.id));
    if (resource.storageKey) {
      await getStorage()
        .delete(resource.storageKey)
        .catch(() => {});
    }
    ok(res, { deleted: true });
  }),
);

// ---------- votes ----------

async function applyVote(
  table: typeof resourceVotes | typeof reviewVotes,
  fkKey: "resourceId" | "reviewId",
  targetId: string,
  userId: string,
  voteType: "upvote" | "downvote" | null,
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const fkCol =
      fkKey === "resourceId"
        ? (resourceVotes as typeof resourceVotes).resourceId
        : (reviewVotes as typeof reviewVotes).reviewId;
    const [existing] = await tx
      .select()
      .from(table)
      .where(and(eq(fkCol, targetId), eq(table.userId, userId)))
      .limit(1);
    if (voteType === null || existing?.voteType === voteType) {
      // Remove vote: explicit DELETE, or re-submitting the same vote (toggle).
      if (existing) await tx.delete(table).where(eq(table.id, existing.id));
    } else if (!existing) {
      await tx.insert(table).values({
        [fkKey]: targetId,
        userId,
        voteType,
      } as never);
    } else if (existing.voteType !== voteType) {
      await tx
        .update(table)
        .set({ voteType, updatedAt: new Date() })
        .where(eq(table.id, existing.id));
    }
  });
}

router.post(
  "/:id/vote",
  requireAuth,
  validateBody(voteSchema),
  asyncHandler(async (req, res, next) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource) return next(notFound("Resource not found"));
    const { vote_type } = req.body as z.infer<typeof voteSchema>;
    await applyVote(
      resourceVotes,
      "resourceId",
      resource.id,
      req.user!.id,
      vote_type,
    );
    const db = await getDb();
    const [counts] = await db
      .select({
        up: sql<number>`count(*) filter (where ${resourceVotes.voteType} = 'upvote')`,
        down: sql<number>`count(*) filter (where ${resourceVotes.voteType} = 'downvote')`,
      })
      .from(resourceVotes)
      .where(eq(resourceVotes.resourceId, resource.id));
    const [mine] = await db
      .select({ voteType: resourceVotes.voteType })
      .from(resourceVotes)
      .where(
        and(
          eq(resourceVotes.resourceId, resource.id),
          eq(resourceVotes.userId, req.user!.id),
        ),
      )
      .limit(1);
    ok(res, {
      userVote: mine?.voteType ?? null,
      upvotes: Number(counts?.up ?? 0),
      downvotes: Number(counts?.down ?? 0),
      score: Number(counts?.up ?? 0) - Number(counts?.down ?? 0),
    });
  }),
);

router.delete(
  "/:id/vote",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource) return next(notFound("Resource not found"));
    await applyVote(
      resourceVotes,
      "resourceId",
      resource.id,
      req.user!.id,
      null,
    );
    ok(res, { userVote: null });
  }),
);

// ---------- bookmarks ----------

router.post(
  "/:id/bookmark",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource) return next(notFound("Resource not found"));
    const db = await getDb();
    await db
      .insert(bookmarks)
      .values({ resourceId: resource.id, userId: req.user!.id })
      .onConflictDoNothing();
    ok(res, { bookmarked: true });
  }),
);

router.delete(
  "/:id/bookmark",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    await db
      .delete(bookmarks)
      .where(
        and(
          eq(bookmarks.resourceId, req.params.id!),
          eq(bookmarks.userId, req.user!.id),
        ),
      );
    ok(res, { bookmarked: false });
  }),
);

// ---------- resource reviews ----------

const reviewScoreSql = sql<number>`coalesce((select sum(case when ${reviewVotes.voteType} = 'upvote' then 1 when ${reviewVotes.voteType} = 'downvote' then -1 else 0 end) from ${reviewVotes} where ${reviewVotes.reviewId} = ${resourceReviews.id}), 0)`;
const reviewUpSql = sql<number>`coalesce((select count(*) from ${reviewVotes} where ${reviewVotes.reviewId} = ${resourceReviews.id} and ${reviewVotes.voteType} = 'upvote'), 0)`;

async function attachReviewExtras(
  rows: {
    review: typeof resourceReviews.$inferSelect;
    authorName: string;
    authorCollegeId: string | null;
    score: unknown;
    upvotes: unknown;
  }[],
  userId?: string,
) {
  const db = await getDb();
  const reviewIds = rows.map((r) => r.review.id);
  const result = new Map<string, { replies: unknown[]; userVote: string | null }>();
  for (const r of rows) {
    result.set(r.review.id, { replies: [], userVote: null });
  }
  if (reviewIds.length === 0) return result;

  // Direct replies to the listed top-level reviews.
  const replies = await db
    .select({
      review: resourceReviews,
      authorName: users.name,
      authorCollegeId: users.collegeId,
      score: reviewScoreSql,
      upvotes: reviewUpSql,
    })
    .from(resourceReviews)
    .innerJoin(users, eq(resourceReviews.userId, users.id))
    .where(
      and(
        sql`${resourceReviews.parentReviewId} in (${sql.join(reviewIds.map((i) => sql`${i}`), sql`, `)})`,
        eq(resourceReviews.moderationStatus, "visible"),
      ),
    )
    .orderBy(resourceReviews.createdAt);

  const replyIds = replies.map((r) => r.review.id);
  const allIds = [...reviewIds, ...replyIds];
  let userVotes = new Map<string, string>();
  if (userId && allIds.length > 0) {
    const votes = await db
      .select()
      .from(reviewVotes)
      .where(
        and(
          eq(reviewVotes.userId, userId),
          sql`${reviewVotes.reviewId} in (${sql.join(allIds.map((i) => sql`${i}`), sql`, `)})`,
        ),
      );
    userVotes = new Map(votes.map((v) => [v.reviewId, v.voteType]));
  }

  const shape = (
    r: (typeof rows)[number] | (typeof replies)[number],
  ) => ({
    ...r.review,
    author: { name: r.authorName, collegeId: r.authorCollegeId },
    score: Number(r.score),
    upvotes: Number(r.upvotes),
    userVote: userVotes.get(r.review.id) ?? null,
  });

  for (const reply of replies) {
    const parent = reply.review.parentReviewId!;
    result.get(parent)?.replies.push(shape(reply));
  }
  for (const r of rows) {
    result.get(r.review.id)!.userVote = userVotes.get(r.review.id) ?? null;
  }
  return result;
}

router.get(
  "/:id/reviews",
  optionalAuth,
  validateQuery(listReviewsQuery),
  asyncHandler(async (req, res) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource) return next404(res);
    const q = req.validatedQuery as z.infer<typeof listReviewsQuery>;
    const db = await getDb();

    const where = and(
      eq(resourceReviews.resourceId, resource.id),
      sql`${resourceReviews.parentReviewId} is null`,
      eq(resourceReviews.moderationStatus, "visible"),
    );

    const orderBy =
      q.sort === "newest"
        ? desc(resourceReviews.createdAt)
        : q.sort === "oldest"
          ? sql`${resourceReviews.createdAt} asc`
          : [desc(reviewScoreSql), desc(resourceReviews.createdAt)];

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          review: resourceReviews,
          authorName: users.name,
          authorCollegeId: users.collegeId,
          score: reviewScoreSql,
          upvotes: reviewUpSql,
        })
        .from(resourceReviews)
        .innerJoin(users, eq(resourceReviews.userId, users.id))
        .where(where)
        .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(resourceReviews).where(where),
    ]);

    const extras = await attachReviewExtras(rows, req.user?.id);
    okList(
      res,
      rows.map((r) => ({
        ...r.review,
        author: { name: r.authorName, collegeId: r.authorCollegeId },
        score: Number(r.score),
        upvotes: Number(r.upvotes),
        userVote: extras.get(r.review.id)?.userVote ?? null,
        replies: extras.get(r.review.id)?.replies ?? [],
      })),
      { page: q.page, pageSize: q.pageSize, total: totalRows[0]?.n ?? 0 },
    );
  }),
);

function next404(res: Parameters<typeof fail>[0]) {
  fail(res, 404, "not_found", "Resource not found");
}

router.post(
  "/:id/reviews",
  requireAuth,
  validateBody(createReviewSchema),
  asyncHandler(async (req, res, next) => {
    const resource = await getVisibleResource(req.params.id!, req.user);
    if (!resource) return next(notFound("Resource not found"));
    const { content, parentReviewId } = req.body as z.infer<
      typeof createReviewSchema
    >;
    const db = await getDb();
    if (parentReviewId) {
      const [parent] = await db
        .select({ id: resourceReviews.id, resourceId: resourceReviews.resourceId })
        .from(resourceReviews)
        .where(eq(resourceReviews.id, parentReviewId))
        .limit(1);
      if (!parent || parent.resourceId !== resource.id) {
        return next(badRequest("Parent review not found for this resource"));
      }
    }
    const [review] = await db
      .insert(resourceReviews)
      .values({
        resourceId: resource.id,
        userId: req.user!.id,
        parentReviewId: parentReviewId ?? null,
        content,
      })
      .returning();
    ok(res, { review });
  }),
);

// ---------- single review operations (mounted at /reviews too) ----------

export async function handleReviewPatch(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const db = await getDb();
  const [review] = await db
    .select()
    .from(resourceReviews)
    .where(eq(resourceReviews.id, req.params.reviewId!))
    .limit(1);
  if (!review) return next(notFound("Review not found"));
  if (review.userId !== req.user!.id) return next(forbidden());
  const { content } = req.body as z.infer<typeof updateReviewSchema>;
  const [updated] = await db
    .update(resourceReviews)
    .set({ content, updatedAt: new Date() })
    .where(eq(resourceReviews.id, review.id))
    .returning();
  ok(res, { review: updated });
}

export async function handleReviewDelete(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const db = await getDb();
  const [review] = await db
    .select()
    .from(resourceReviews)
    .where(eq(resourceReviews.id, req.params.reviewId!))
    .limit(1);
  if (!review) return next(notFound("Review not found"));
  const isOwner = review.userId === req.user!.id;
  const isMod = req.user!.role === "moderator" || req.user!.role === "admin";
  if (!isOwner && !isMod) return next(forbidden());
  if (isMod && !isOwner) {
    await db.insert(moderationLogs).values({
      actorId: req.user!.id,
      targetType: "resource_review",
      targetId: review.id,
      action: "remove_resource_review",
    });
  }
  await db.delete(resourceReviews).where(eq(resourceReviews.id, review.id));
  ok(res, { deleted: true });
}

export async function handleReviewVote(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const db = await getDb();
  const [review] = await db
    .select({ id: resourceReviews.id })
    .from(resourceReviews)
    .where(
      and(
        eq(resourceReviews.id, req.params.reviewId!),
        eq(resourceReviews.moderationStatus, "visible"),
      ),
    )
    .limit(1);
  if (!review) return next(notFound("Review not found"));

  const hasBody = req.body && Object.keys(req.body).length > 0;
  const voteType = hasBody
    ? (req.body as z.infer<typeof voteSchema>).vote_type
    : "upvote";

  await applyVote(
    reviewVotes,
    "reviewId",
    review.id,
    req.user!.id,
    voteType,
  );
  const [counts] = await db
    .select({
      up: sql<number>`count(*) filter (where ${reviewVotes.voteType} = 'upvote')`,
      down: sql<number>`count(*) filter (where ${reviewVotes.voteType} = 'downvote')`,
    })
    .from(reviewVotes)
    .where(eq(reviewVotes.reviewId, review.id));
  const [mine] = await db
    .select({ voteType: reviewVotes.voteType })
    .from(reviewVotes)
    .where(
      and(
        eq(reviewVotes.reviewId, review.id),
        eq(reviewVotes.userId, req.user!.id),
      ),
    )
    .limit(1);
  ok(res, {
    userVote: mine?.voteType ?? null,
    upvotes: Number(counts?.up ?? 0),
    downvotes: Number(counts?.down ?? 0),
    score: Number(counts?.up ?? 0) - Number(counts?.down ?? 0),
  });
}

export async function handleReviewReport(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const db = await getDb();
  const [review] = await db
    .select({ id: resourceReviews.id, userId: resourceReviews.userId })
    .from(resourceReviews)
    .where(eq(resourceReviews.id, req.params.reviewId!))
    .limit(1);
  if (!review) return next(notFound("Review not found"));
  if (review.userId === req.user!.id) {
    return next(badRequest("You cannot report your own review"));
  }
  const { reason } = req.body as z.infer<typeof reportSchema>;
  const [report] = await db
    .insert(reports)
    .values({
      reporterId: req.user!.id,
      targetType: "resource_review",
      targetId: review.id,
      reason,
    })
    .returning();
  ok(res, { report });
}

export default router;
