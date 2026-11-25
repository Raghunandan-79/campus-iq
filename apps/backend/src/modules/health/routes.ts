import { Router } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { asyncHandler } from "../../middleware/common";
import { ok } from "../../utils/http";
import { config } from "../../config/env";

const router = Router();

router.get("/", (_req, res) => {
  ok(res, { status: "ok", service: "campusiq-api", uptime: process.uptime() });
});

router.get(
  "/db",
  asyncHandler(async (_req, res) => {
    const db = await getDb();
    await db.execute(sql`select 1`);
    ok(res, {
      status: "ok",
      driver: config.DATABASE_URL ? "postgres" : "pglite",
    });
  }),
);

export default router;
