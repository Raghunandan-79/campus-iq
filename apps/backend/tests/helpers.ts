import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";
import { getDb } from "../src/db";
import { colleges, subjects } from "../src/db/schema";

export interface TestContext {
  app: Express;
  collegeId: string;
  otherCollegeId: string;
  subjectId: string;
}

let ctx: TestContext | null = null;

export async function setupApp(): Promise<TestContext> {
  if (ctx) return ctx;
  const app = createApp();
  const db = await getDb();

  const [c1] = await db
    .insert(colleges)
    .values({ name: "Test College A", location: "Testville" })
    .returning();
  const [c2] = await db
    .insert(colleges)
    .values({ name: "Test College B", location: "Other City" })
    .returning();
  const [s1] = await db
    .insert(subjects)
    .values({ name: "Test Subject", code: "TS101", semester: 3 })
    .returning();

  ctx = {
    app,
    collegeId: c1!.id,
    otherCollegeId: c2!.id,
    subjectId: s1!.id,
  };
  return ctx;
}

export async function signup(
  app: Express,
  email: string,
  collegeId?: string,
) {
  return request(app)
    .post("/api/v1/auth/signup")
    .send({
      name: "Test User",
      email,
      password: "password123",
      collegeId: collegeId ?? null,
    });
}

export async function login(app: Express, email: string) {
  return request(app)
    .post("/api/v1/auth/login")
    .send({ email, password: "password123" });
}
