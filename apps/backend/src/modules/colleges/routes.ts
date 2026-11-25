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
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import {
  collegeRequests,
  collegeReviews,
  colleges,
  moderationLogs,
  reports,
  resourceReviews,
  resources,
  users,
} from "../../db/schema";
import type { AuthUser } from "../../middleware/auth";
import { requireAuth, requireModerator } from "../../middleware/auth";
import {
  asyncHandler,
  validateBody,
  validateQuery,
} from "../../middleware/common";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors";
import { fail, ok, okList } from "../../utils/http";
import {
  collegeReviewSchema,
  listCollegeReviewsQuery,
  listCollegesQuery,
  reportSchema,
} from "./schemas";

const router = Router();
const collegeReviewsRouter = Router();
const moderationRouter = Router();

// ---------- helpers ----------

async function collegeAggregates(collegeId: string) {
  const db = await getDb();
  const [agg] = await db
    .select({
      reviewCount: count(),
      avgOverall: sql<number | null>`avg(${collegeReviews.overallRating})`,
      avgAcademics: sql<number | null>`avg(${collegeReviews.academicsRating})`,
      avgFaculty: sql<number | null>`avg(${collegeReviews.facultyRating})`,
      avgInfrastructure: sql<
        number | null
      >`avg(${collegeReviews.infrastructureRating})`,
      avgCampusLife: sql<
        number | null
      >`avg(${collegeReviews.campusLifeRating})`,
      avgPlacements: sql<
        number | null
      >`avg(${collegeReviews.placementsRating})`,
      avgAdministration: sql<
        number | null
      >`avg(${collegeReviews.administrationRating})`,
    })
    .from(collegeReviews)
    .where(
      and(
        eq(collegeReviews.collegeId, collegeId),
        eq(collegeReviews.moderationStatus, "visible"),
      ),
    );
  const [resourceCount] = await db
    .select({ n: count() })
    .from(resources)
    .where(
      and(
        eq(resources.collegeId, collegeId),
        eq(resources.uploadStatus, "ready"),
        ne(resources.moderationStatus, "removed"),
      ),
    );
  const [memberCount] = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.collegeId, collegeId));
  return {
    reviewCount: agg?.reviewCount ?? 0,
    avgOverall: agg?.avgOverall ?? null,
    avgAcademics: agg?.avgAcademics ?? null,
    avgFaculty: agg?.avgFaculty ?? null,
    avgInfrastructure: agg?.avgInfrastructure ?? null,
    avgCampusLife: agg?.avgCampusLife ?? null,
    avgPlacements: agg?.avgPlacements ?? null,
    avgAdministration: agg?.avgAdministration ?? null,
    resourceCount: resourceCount?.n ?? 0,
    memberCount: memberCount?.n ?? 0,
  };
}

// ---------- directory ----------

router.get(
  "/",
  validateQuery(listCollegesQuery),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as z.infer<typeof listCollegesQuery>;
    const db = await getDb();
    const conditions = [];
    if (q.q) {
      conditions.push(
        or(ilike(colleges.name, `%${q.q}%`), ilike(colleges.location, `%${q.q}%`)),
      );
    }
    if (q.location) conditions.push(ilike(colleges.location, `%${q.location}%`));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(colleges)
        .where(where)
        .orderBy(colleges.name)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(colleges).where(where),
    ]);

    const items = await Promise.all(
      rows.map(async (c) => ({ ...c, ...(await collegeAggregates(c.id)) })),
    );
    okList(res, items, {
      page: q.page,
      pageSize: q.pageSize,
      total: totalRows[0]?.n ?? 0,
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const [college] = await db
      .select()
      .from(colleges)
      .where(eq(colleges.id, req.params.id!))
      .limit(1);
    if (!college) return next404(res);
    ok(res, { college: { ...college, ...(await collegeAggregates(college.id)) } });
  }),
);

function next404(res: Parameters<typeof fail>[0]) {
  fail(res, 404, "not_found", "College not found");
}

// ---------- reviews ----------

router.get(
  "/:id/reviews",
  validateQuery(listCollegeReviewsQuery),
  asyncHandler(async (req, res) => {
    const collegeId = req.params.id!;
    const q = req.validatedQuery as z.infer<typeof listCollegeReviewsQuery>;
    const db = await getDb();

    const [college] = await db
      .select({ id: colleges.id })
      .from(colleges)
      .where(eq(colleges.id, collegeId))
      .limit(1);
    if (!college) return next404(res);

    const where = and(
      eq(collegeReviews.collegeId, collegeId),
      eq(collegeReviews.moderationStatus, "visible"),
    );

    const orderBy =
      q.sort === "highest"
        ? desc(collegeReviews.overallRating)
        : q.sort === "lowest"
          ? sql`${collegeReviews.overallRating} asc`
          : q.sort === "helpful"
            ? desc(collegeReviews.overallRating)
            : desc(collegeReviews.createdAt);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          review: collegeReviews,
          authorName: users.name,
          authorCollegeId: users.collegeId,
        })
        .from(collegeReviews)
        .innerJoin(users, eq(collegeReviews.userId, users.id))
        .where(where)
        .orderBy(orderBy)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(collegeReviews).where(where),
    ]);

    okList(
      res,
      rows.map((r) => ({
        ...r.review,
        author: { name: r.authorName, collegeId: r.authorCollegeId },
      })),
      { page: q.page, pageSize: q.pageSize, total: totalRows[0]?.n ?? 0 },
    );
  }),
);

router.post(
  "/:id/reviews",
  requireAuth,
  validateBody(collegeReviewSchema),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const collegeId = req.params.id!;
    const [college] = await db
      .select({ id: colleges.id })
      .from(colleges)
      .where(eq(colleges.id, collegeId))
      .limit(1);
    if (!college) return next(notFound("College not found"));

    const body = req.body as z.infer<typeof collegeReviewSchema>;
    try {
      const [review] = await db
        .insert(collegeReviews)
        .values({ ...body, collegeId, userId: req.user!.id })
        .returning();
      ok(res, { review });
    } catch (e) {
      const err = e as { code?: string; message?: string; cause?: { code?: string } };
      if (
        err.code === "23505" ||
        err.cause?.code === "23505" ||
        String(e).includes("college_reviews_unique") ||
        String(e).includes("duplicate key")
      ) {
        return next(
          conflict("You have already reviewed this college. Edit your existing review instead."),
        );
      }
      throw e;
    }
  }),
);

// ---------- single college review (edit/delete/report) ----------

async function getOwnedCollegeReview(reviewId: string, user: AuthUser) {
  const db = await getDb();
  const [review] = await db
    .select()
    .from(collegeReviews)
    .where(eq(collegeReviews.id, reviewId))
    .limit(1);
  if (!review) return { review: null, db };
  const isOwner = review.userId === user.id;
  const isMod = user.role === "moderator" || user.role === "admin";
  return { review, db, isOwner, isMod, user };
}

collegeReviewsRouter.patch(
  "/:reviewId",
  requireAuth,
  validateBody(collegeReviewSchema.partial()),
  asyncHandler(async (req, res, next) => {
    const { review, db, isOwner, isMod } = await getOwnedCollegeReview(
      req.params.reviewId!,
      req.user!,
    );
    if (!review) return next(notFound("Review not found"));
    if (!isOwner && !isMod) return next(forbidden());

    const body = req.body as Partial<z.infer<typeof collegeReviewSchema>>;
    const [updated] = await db
      .update(collegeReviews)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(collegeReviews.id, review.id))
      .returning();
    ok(res, { review: updated });
  }),
);

collegeReviewsRouter.delete(
  "/:reviewId",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const { review, db, isOwner, isMod, user } = await getOwnedCollegeReview(
      req.params.reviewId!,
      req.user!,
    );
    if (!review) return next(notFound("Review not found"));
    if (!isOwner && !isMod) return next(forbidden());

    if (isMod && !isOwner) {
      await db.insert(moderationLogs).values({
        actorId: user.id,
        targetType: "college_review",
        targetId: review.id,
        action: "remove_college_review",
      });
    }
    await db.delete(collegeReviews).where(eq(collegeReviews.id, review.id));
    ok(res, { deleted: true });
  }),
);

collegeReviewsRouter.post(
  "/:reviewId/report",
  requireAuth,
  validateBody(reportSchema),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [review] = await db
      .select({ id: collegeReviews.id, userId: collegeReviews.userId })
      .from(collegeReviews)
      .where(eq(collegeReviews.id, req.params.reviewId!))
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
        targetType: "college_review",
        targetId: review.id,
        reason,
      })
      .returning();
    ok(res, { report });
  }),
);

// ---------- moderation ----------

moderationRouter.get(
  "/reports",
  requireModerator,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const status = (req.query.status as string) || "open";
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.status, status as "open" | "resolved" | "dismissed"))
      .orderBy(desc(reports.createdAt))
      .limit(100);
    ok(res, { reports: rows });
  }),
);

moderationRouter.post(
  "/reports/:id/resolve",
  requireModerator,
  validateBody(z.object({ action: z.enum(["hide", "remove", "dismiss"]) })),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const { action } = req.body as { action: "hide" | "remove" | "dismiss" };
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, req.params.id!))
      .limit(1);
    if (!report) return next(notFound("Report not found"));

    const newStatus =
      action === "dismiss" ? "dismissed" : ("resolved" as const);

    if (action === "hide" || action === "remove") {
      const modStatus = action === "hide" ? "hidden" : "removed";
      if (report.targetType === "resource") {
        await db
          .update(resources)
          .set({ moderationStatus: modStatus, updatedAt: new Date() })
          .where(eq(resources.id, report.targetId));
      } else if (report.targetType === "resource_review") {
        await db
          .update(resourceReviews)
          .set({ moderationStatus: modStatus, updatedAt: new Date() })
          .where(eq(resourceReviews.id, report.targetId));
      } else {
        await db
          .update(collegeReviews)
          .set({ moderationStatus: modStatus, updatedAt: new Date() })
          .where(eq(collegeReviews.id, report.targetId));
      }
      await db.insert(moderationLogs).values({
        actorId: req.user!.id,
        targetType: report.targetType,
        targetId: report.targetId,
        action: `${action}_${report.targetType}`,
      });
    }

    const [updated] = await db
      .update(reports)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(reports.id, report.id))
      .returning();
    ok(res, { report: updated });
  }),
);

const requestCollegeSchema = z.object({
  name: z.string().trim().min(2).max(200),
  location: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().url().max(500).optional().nullable(),
});

router.post(
  "/request",
  requireAuth,
  validateBody(requestCollegeSchema),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const body = req.body as z.infer<typeof requestCollegeSchema>;
    const [existingCollege] = await db
      .select({ id: colleges.id })
      .from(colleges)
      .where(ilike(colleges.name, body.name))
      .limit(1);
    if (existingCollege) return next(conflict("This college already exists"));
    const [pending] = await db
      .select({ id: collegeRequests.id })
      .from(collegeRequests)
      .where(
        and(
          ilike(collegeRequests.name, body.name),
          eq(collegeRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (pending) return next(conflict("A request for this college is already pending"));
    const [request] = await db
      .insert(collegeRequests)
      .values({
        name: body.name,
        location: body.location ?? null,
        website: body.website ?? null,
        requestedBy: req.user!.id,
      })
      .returning();
    ok(res, { request });
  }),
);

export { collegeReviewsRouter, moderationRouter };
export default router;
