import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupApp, signup } from "./helpers";
import type { Express } from "express";

async function makeUser(app: Express, email: string, collegeId: string) {
  const res = await signup(app, email, collegeId);
  return { cookie: res.headers["set-cookie"] as unknown as string[] };
}

const reviewBody = {
  overallRating: 4,
  academicsRating: 4,
  facultyRating: 3,
  infrastructureRating: 4,
  campusLifeRating: 5,
  placementsRating: 4,
  administrationRating: 3,
  content: "Good academics, active fests.",
};

describe("colleges", () => {
  it("lists colleges and shows detail with aggregates", async () => {
    const { app, collegeId } = await setupApp();
    const u = await makeUser(app, "col-alice@test.dev", collegeId);

    const create = await request(app)
      .post(`/api/v1/colleges/${collegeId}/reviews`)
      .set("Cookie", u.cookie)
      .send(reviewBody);
    expect(create.status).toBe(200);

    // Duplicate review per user per college is rejected.
    const dup = await request(app)
      .post(`/api/v1/colleges/${collegeId}/reviews`)
      .set("Cookie", u.cookie)
      .send(reviewBody);
    expect(dup.status).toBe(409);

    const detail = await request(app).get(`/api/v1/colleges/${collegeId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.college.reviewCount).toBe(1);
    expect(Number(detail.body.data.college.avgOverall)).toBeCloseTo(4);

    const list = await request(app).get("/api/v1/colleges");
    expect(list.status).toBe(200);
    const found = list.body.data.find(
      (c: { id: string }) => c.id === collegeId,
    );
    expect(found.reviewCount).toBe(1);
  });

  it("edits and deletes own review; others cannot edit", async () => {
    const { app, collegeId } = await setupApp();
    const u1 = await makeUser(app, "col-u1@test.dev", collegeId);
    const u2 = await makeUser(app, "col-u2@test.dev", collegeId);

    const create = await request(app)
      .post(`/api/v1/colleges/${collegeId}/reviews`)
      .set("Cookie", u1.cookie)
      .send(reviewBody);
    const rid = create.body.data.review.id;

    const patch = await request(app)
      .patch(`/api/v1/college-reviews/${rid}`)
      .set("Cookie", u1.cookie)
      .send({ overallRating: 5, content: "Updated review" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.review.overallRating).toBe(5);

    const forbiddenPatch = await request(app)
      .patch(`/api/v1/college-reviews/${rid}`)
      .set("Cookie", u2.cookie)
      .send({ overallRating: 1 });
    expect(forbiddenPatch.status).toBe(403);

    const before = await request(app).get(`/api/v1/colleges/${collegeId}`);
    const countBefore = before.body.data.college.reviewCount;

    const del = await request(app)
      .delete(`/api/v1/college-reviews/${rid}`)
      .set("Cookie", u1.cookie);
    expect(del.status).toBe(200);

    const detail = await request(app).get(`/api/v1/colleges/${collegeId}`);
    expect(detail.body.data.college.reviewCount).toBe(countBefore - 1);
  });

  it("reports a college review", async () => {
    const { app, collegeId } = await setupApp();
    const u1 = await makeUser(app, "col-r1@test.dev", collegeId);
    const u2 = await makeUser(app, "col-r2@test.dev", collegeId);

    const create = await request(app)
      .post(`/api/v1/colleges/${collegeId}/reviews`)
      .set("Cookie", u1.cookie)
      .send(reviewBody);
    const rid = create.body.data.review.id;

    const report = await request(app)
      .post(`/api/v1/college-reviews/${rid}/report`)
      .set("Cookie", u2.cookie)
      .send({ reason: "This review contains personal attacks." });
    expect(report.status).toBe(200);
  });
});
