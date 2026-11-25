import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { collegeRequests, colleges, users } from "../../db/schema";
import { requireAuth } from "../../middleware/auth";
import {
  asyncHandler,
  validateBody,
  validateQuery,
} from "../../middleware/common";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors";
import { ok, okList } from "../../utils/http";

const router = Router();

router.use(requireAuth);
router.use((req, _res, next) => {
  if (req.user?.role !== "admin") return next(forbidden("Admin access required"));
  next();
});

const collegeBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  domain: z.string().trim().max(255).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().url().max(500).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
});

const listRequestsQuery = z.object({
  status: z.enum(["pending", "approved", "dismissed"]).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const approveSchema = z.object({
  domain: z.string().trim().max(255).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().url().max(500).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
});

// ---------- college requests ----------

router.get(
  "/college-requests",
  validateQuery(listRequestsQuery),
  asyncHandler(async (req, res) => {
    const q = req.validatedQuery as z.infer<typeof listRequestsQuery>;
    const db = await getDb();
    const rows = await db
      .select({
        request: collegeRequests,
        requesterName: users.name,
        requesterEmail: users.email,
        collegeName: colleges.name,
      })
      .from(collegeRequests)
      .innerJoin(users, eq(collegeRequests.requestedBy, users.id))
      .leftJoin(colleges, eq(collegeRequests.createdCollegeId, colleges.id))
      .where(eq(collegeRequests.status, q.status))
      .orderBy(desc(collegeRequests.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize);
    okList(
      res,
      rows.map((r) => ({
        ...r.request,
        requester: { name: r.requesterName, email: r.requesterEmail },
        createdCollegeName: r.collegeName,
      })),
      { page: q.page, pageSize: q.pageSize, total: rows.length },
    );
  }),
);

router.post(
  "/college-requests/:id/approve",
  validateBody(approveSchema),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [request] = await db
      .select()
      .from(collegeRequests)
      .where(eq(collegeRequests.id, req.params.id!))
      .limit(1);
    if (!request) return next(notFound("Request not found"));
    if (request.status !== "pending") {
      return next(conflict("Request is not pending"));
    }
    const body = req.body as z.infer<typeof approveSchema>;
    const [college] = await db
      .insert(colleges)
      .values({
        name: request.name,
        domain: body.domain ?? null,
        location: body.location ?? request.location,
        website: body.website ?? request.website,
        description: body.description ?? null,
      })
      .returning();
    if (!college) return next(badRequest("Failed to create college"));
    await db
      .update(collegeRequests)
      .set({ status: "approved", createdCollegeId: college.id, updatedAt: new Date() })
      .where(eq(collegeRequests.id, request.id));
    ok(res, { college, requestId: request.id });
  }),
);

router.post(
  "/college-requests/:id/dismiss",
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [request] = await db
      .select()
      .from(collegeRequests)
      .where(eq(collegeRequests.id, req.params.id!))
      .limit(1);
    if (!request) return next(notFound("Request not found"));
    if (request.status !== "pending") {
      return next(conflict("Request is not pending"));
    }
    await db
      .update(collegeRequests)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(eq(collegeRequests.id, request.id));
    ok(res, { dismissed: true });
  }),
);

// ---------- college management ----------

router.get(
  "/colleges",
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(colleges)
      .orderBy(colleges.name);
    okList(res, rows, { page: 1, pageSize: rows.length, total: rows.length });
  }),
);

router.post(
  "/colleges",
  validateBody(collegeBodySchema),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const body = req.body as z.infer<typeof collegeBodySchema>;
    const [college] = await db.insert(colleges).values(body).returning();
    ok(res, { college });
  }),
);

router.patch(
  "/colleges/:id",
  validateBody(collegeBodySchema.partial()),
  asyncHandler(async (req, res, next) => {
    const db = await getDb();
    const [college] = await db
      .update(colleges)
      .set({ ...(req.body as object), updatedAt: new Date() })
      .where(eq(colleges.id, req.params.id!))
      .returning();
    if (!college) return next(notFound("College not found"));
    ok(res, { college });
  }),
);

export default router;
