import { Router } from "express";
import { z } from "zod";
import { createSubjectSchema } from "../colleges/schemas";
import { requireAuth, requireModerator } from "../../middleware/auth";
import {
  asyncHandler,
  validateBody,
  validateQuery,
} from "../../middleware/common";
import { notFound } from "../../utils/errors";
import { ok, okList } from "../../utils/http";
import { getDb } from "../../db";
import { colleges, resources, subjects } from "../../db/schema";
import { optionalAuth } from "../../middleware/auth";
import { and, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";

const router = Router();

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  collegeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

router.get(
  "/",
  validateQuery(listQuery),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as z.infer<typeof listQuery>;
    const db = await getDb();
    const conditions = [];
    if (q.q) {
      conditions.push(
        or(ilike(subjects.name, `%${q.q}%`), ilike(subjects.code, `%${q.q}%`)),
      );
    }
    if (q.collegeId) conditions.push(eq(subjects.collegeId, q.collegeId));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          subject: subjects,
          collegeName: colleges.name,
        })
        .from(subjects)
        .leftJoin(colleges, eq(subjects.collegeId, colleges.id))
        .where(where)
        .orderBy(subjects.name)
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ n: count() }).from(subjects).where(where),
    ]);
    okList(
      res,
      rows.map((r) => ({ ...r.subject, collegeName: r.collegeName })),
      { page: q.page, pageSize: q.pageSize, total: totalRows[0]?.n ?? 0 },
    );
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [row] = await db
      .select({ subject: subjects, collegeName: colleges.name })
      .from(subjects)
      .leftJoin(colleges, eq(subjects.collegeId, colleges.id))
      .where(eq(subjects.id, req.params.id!))
      .limit(1);
    if (!row) return next(notFound("Subject not found"));
    ok(res, { subject: { ...row.subject, collegeName: row.collegeName } });
  }),
);

router.get(
  "/:id/resources",
  optionalAuth,
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, req.params.id!))
      .limit(1);
    if (!subject) return next(notFound("Subject not found"));

    const user = req.user;
    const vis =
      user == null
        ? eq(resources.visibility, "campus")
        : or(
            eq(resources.visibility, "campus"),
            and(
              eq(resources.visibility, "college"),
              user.collegeId
                ? eq(resources.collegeId, user.collegeId)
                : sql`false`,
            ),
            eq(resources.uploadedBy, user.id),
          );

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const where = and(
      eq(resources.subjectId, subject.id),
      eq(resources.uploadStatus, "ready"),
      ne(resources.moderationStatus, "removed"),
      vis,
    );
    const [rows, totalRows] = await Promise.all([
      db
        .select({ resource: resources })
        .from(resources)
        .where(where)
        .orderBy(desc(resources.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ n: count() }).from(resources).where(where),
    ]);
    okList(
      res,
      rows.map((r) => r.resource),
      { page, pageSize, total: totalRows[0]?.n ?? 0 },
    );
  }),
);

router.post(
  "/",
  requireAuth,
  requireModerator,
  validateBody(createSubjectSchema),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const [subject] = await db
      .insert(subjects)
      .values(req.body as z.infer<typeof createSubjectSchema>)
      .returning();
    ok(res, { subject });
  }),
);

export default router;
