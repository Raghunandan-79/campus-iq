import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { resourceReviews, reviewVotes } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler, validateBody } from "../../middleware/common";
import { badRequest, notFound } from "../../utils/errors";
import { ok } from "../../utils/http";
import { reportSchema } from "../colleges/schemas";
import { updateReviewSchema, voteSchema } from "../resources/schemas";
import {
  handleReviewDelete,
  handleReviewPatch,
  handleReviewReport,
  handleReviewVote,
} from "../resources/routes";

const router = Router();

router.patch(
  "/:reviewId",
  requireAuth,
  validateBody(updateReviewSchema),
  asyncHandler(async (req, res, next) => {
    await handleReviewPatch(req, res, next);
  }),
);

router.delete(
  "/:reviewId",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    await handleReviewDelete(req, res, next);
  }),
);

router.post(
  "/:reviewId/vote",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    if (req.body && Object.keys(req.body).length > 0) {
      const parsed = voteSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(badRequest("Validation failed", parsed.error.flatten()));
      }
      req.body = parsed.data as z.infer<typeof voteSchema>;
    }
    await handleReviewVote(req, res, next);
  }),
);

router.delete(
  "/:reviewId/vote",
  requireAuth,
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [review] = await db
      .select({ id: resourceReviews.id })
      .from(resourceReviews)
      .where(eq(resourceReviews.id, req.params.reviewId!))
      .limit(1);
    if (!review) return next(notFound("Review not found"));
    await db
      .delete(reviewVotes)
      .where(
        and(
          eq(reviewVotes.reviewId, review.id),
          eq(reviewVotes.userId, req.user!.id),
        ),
      );
    const [counts] = await db
      .select({
        up: sql<number>`count(*) filter (where ${reviewVotes.voteType} = 'upvote')`,
        down: sql<number>`count(*) filter (where ${reviewVotes.voteType} = 'downvote')`,
      })
      .from(reviewVotes)
      .where(eq(reviewVotes.reviewId, review.id));
    ok(res, {
      userVote: null,
      upvotes: Number(counts?.up ?? 0),
      downvotes: Number(counts?.down ?? 0),
      score: Number(counts?.up ?? 0) - Number(counts?.down ?? 0),
    });
  }),
);

router.post(
  "/:reviewId/report",
  requireAuth,
  validateBody(reportSchema),
  asyncHandler(async (req, res, next) => {
    await handleReviewReport(req, res, next);
  }),
);

export default router;
