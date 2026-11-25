import argon2 from "argon2";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { colleges, users } from "../../db/schema";
import { config } from "../../config/env";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  requireAuth,
  SESSION_COOKIE,
  setSessionCookie,
} from "../../middleware/auth";
import { validateBody } from "../../middleware/common";
import { badRequest, conflict, unauthorized } from "../../utils/errors";
import { ok } from "../../utils/http";
import { loginSchema, signupSchema } from "./schemas";

const router = Router();

function publicUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  collegeId: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    collegeId: u.collegeId,
    createdAt: u.createdAt,
  };
}

router.post("/signup", validateBody(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password, collegeId } = req.body as z.infer<
      typeof signupSchema
    >;
    const db = await getDb();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return next(conflict("An account with this email already exists"));
    }

    if (collegeId) {
      const college = await db
        .select({ id: colleges.id, domain: colleges.domain })
        .from(colleges)
        .where(eq(colleges.id, collegeId))
        .limit(1);
      if (college.length === 0) return next(badRequest("Unknown college"));

      // College email-domain restriction is configurable, off by default.
      const collegeDomain = college[0]?.domain;
      if (config.REQUIRE_COLLEGE_EMAIL_DOMAIN && collegeDomain) {
        const domain = email.split("@")[1] ?? "";
        if (domain !== collegeDomain) {
          return next(
            badRequest(`This college requires a @${collegeDomain} email address`),
          );
        }
      }
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, collegeId: collegeId ?? null })
      .returning();

    const { token, expiresAt } = await createSession(user!.id);
    setSessionCookie(res, token, expiresAt);
    ok(res, { user: publicUser(user!) });
  } catch (e) {
    next(e);
  }
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const db = await getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Constant-ish behavior: always run a hash verify to reduce timing signal.
    const hash =
      user?.passwordHash ??
      "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const valid = await argon2.verify(hash, password).catch(() => false);
    if (!user || !valid) return next(unauthorized("Invalid email or password"));

    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(res, token, expiresAt);
    ok(res, { user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await destroySession(token);
    clearSessionCookie(res);
    ok(res, { loggedOut: true });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);
    if (!user) return next(unauthorized());
    ok(res, { user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;
