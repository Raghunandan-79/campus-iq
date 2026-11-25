import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";
import { config } from "../config/env";
import { forbidden, unauthorized } from "../utils/errors";

export const SESSION_COOKIE = "campusiq_session";
const SESSION_TTL_MS = config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function destroySession(token: string) {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "student" | "moderator" | "admin";
  collegeId: string | null;
}

export async function loadUser(req: Request): Promise<AuthUser | null> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      collegeId: users.collegeId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    collegeId: row.collegeId,
  };
}

/** Attaches req.user when a valid session cookie is present; never rejects. */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    req.user = (await loadUser(req)) ?? undefined;
    next();
  } catch (e) {
    next(e);
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const user = await loadUser(req);
    if (!user) return next(unauthorized());
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export function requireModerator(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== "moderator" && req.user.role !== "admin") {
    return next(forbidden("Moderator access required"));
  }
  next();
}
