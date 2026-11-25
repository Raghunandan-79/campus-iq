import { describe, expect, it } from "vitest";
import request from "supertest";
import { setupApp, signup } from "./helpers";

async function makeUser(app: Express0, email: string, collegeId: string) {
  const res = await signup(app, email, collegeId);
  expect(res.status).toBe(200);
  return {
    cookie: res.headers["set-cookie"] as unknown as string[],
    user: res.body.data.user,
  };
}

type Express0 = import("express").Express;

async function uploadResource(
  app: Express0,
  cookie: string[],
  subjectId: string,
  title = "Test Notes",
) {
  return request(app)
    .post("/api/v1/resources")
    .set("Cookie", cookie)
    .field("title", title)
    .field("resourceType", "notes")
    .field("subjectId", subjectId)
    .attach("file", Buffer.from("%PDF-1.4 hello"), {
      filename: "notes.pdf",
      contentType: "application/pdf",
    });
}

describe("resources", () => {
  it("uploads, lists, searches, and downloads cross-campus", async () => {
    const { app, collegeId, otherCollegeId, subjectId } = await setupApp();
    const alice = await makeUser(app, "res-alice@test.dev", collegeId);
    const bob = await makeUser(app, "res-bob@test.dev", otherCollegeId);

    const up = await uploadResource(app, alice.cookie, subjectId, "OS Unit 4 Notes");
    expect(up.status).toBe(200);
    const rid = up.body.data.resource.id;
    expect(up.body.data.resource.collegeId).toBe(collegeId);

    // Cross-campus discovery: bob (different college) sees it in search.
    const list = await request(app)
      .get("/api/v1/resources")
      .query({ q: "OS Unit 4" });
    expect(list.status).toBe(200);
    expect(list.body.data.some((r: { id: string }) => r.id === rid)).toBe(true);

    // Cross-campus download works for authenticated user from another college.
    const dl = await request(app)
      .get(`/api/v1/resources/${rid}/download`)
      .set("Cookie", bob.cookie);
    expect(dl.status).toBe(200);
    expect(dl.headers["content-type"]).toContain("application/pdf");

    // Anonymous download is rejected.
    const anon = await request(app).get(`/api/v1/resources/${rid}/download`);
    expect(anon.status).toBe(401);
  });

  it("enforces college-only visibility", async () => {
    const { app, collegeId, otherCollegeId, subjectId } = await setupApp();
    const alice = await makeUser(app, "vis-alice@test.dev", collegeId);
    const bob = await makeUser(app, "vis-bob@test.dev", otherCollegeId);

    const up = await request(app)
      .post("/api/v1/resources")
      .set("Cookie", alice.cookie)
      .field("title", "College Only Doc")
      .field("resourceType", "notes")
      .field("subjectId", subjectId)
      .field("visibility", "college")
      .attach("file", Buffer.from("%PDF-1.4 x"), {
        filename: "a.pdf",
        contentType: "application/pdf",
      });
    expect(up.status).toBe(200);
    const rid = up.body.data.resource.id;

    const bobSees = await request(app).get(`/api/v1/resources/${rid}`);
    expect(bobSees.status).toBe(404);

    const aliceSees = await request(app)
      .get(`/api/v1/resources/${rid}`)
      .set("Cookie", alice.cookie);
    expect(aliceSees.status).toBe(200);
  });

  it("rejects non-PDF content", async () => {
    const { app, collegeId, subjectId } = await setupApp();
    const alice = await makeUser(app, "file-alice@test.dev", collegeId);
    const res = await request(app)
      .post("/api/v1/resources")
      .set("Cookie", alice.cookie)
      .field("title", "Fake PDF")
      .field("resourceType", "notes")
      .field("subjectId", subjectId)
      .attach("file", Buffer.from("MZ fake exe"), {
        filename: "evil.pdf",
        contentType: "application/pdf",
      });
    expect(res.status).toBe(400);
  });

  it("supports vote toggle semantics", async () => {
    const { app, collegeId, subjectId } = await setupApp();
    const alice = await makeUser(app, "vote-alice@test.dev", collegeId);
    const carol = await makeUser(app, "vote-carol@test.dev", collegeId);

    const up = await uploadResource(app, alice.cookie, subjectId, "Voting Target");
    const rid = up.body.data.resource.id;

    const v1 = await request(app)
      .post(`/api/v1/resources/${rid}/vote`)
      .set("Cookie", carol.cookie)
      .send({ vote_type: "upvote" });
    expect(v1.body.data.userVote).toBe("upvote");
    expect(v1.body.data.score).toBe(1);

    // Same vote again removes it.
    const v2 = await request(app)
      .post(`/api/v1/resources/${rid}/vote`)
      .set("Cookie", carol.cookie)
      .send({ vote_type: "upvote" });
    expect(v2.body.data.userVote).toBeNull();
    expect(v2.body.data.score).toBe(0);

    // Switch to downvote.
    const v3 = await request(app)
      .post(`/api/v1/resources/${rid}/vote`)
      .set("Cookie", carol.cookie)
      .send({ vote_type: "downvote" });
    expect(v3.body.data.userVote).toBe("downvote");
    expect(v3.body.data.score).toBe(-1);
  });

  it("supports reviews, replies, review votes, bookmarks", async () => {
    const { app, collegeId, subjectId } = await setupApp();
    const alice = await makeUser(app, "rev-alice@test.dev", collegeId);
    const dave = await makeUser(app, "rev-dave@test.dev", collegeId);

    const up = await uploadResource(app, alice.cookie, subjectId, "Reviewable");
    const rid = up.body.data.resource.id;

    const r1 = await request(app)
      .post(`/api/v1/resources/${rid}/reviews`)
      .set("Cookie", dave.cookie)
      .send({ content: "Solid notes, Unit 2 missing." });
    expect(r1.status).toBe(200);
    const reviewId = r1.body.data.review.id;

    const reply = await request(app)
      .post(`/api/v1/resources/${rid}/reviews`)
      .set("Cookie", alice.cookie)
      .send({ content: "Thanks — will fix.", parentReviewId: reviewId });
    expect(reply.status).toBe(200);

    const rv = await request(app)
      .post(`/api/v1/reviews/${reviewId}/vote`)
      .set("Cookie", alice.cookie)
      .send({ vote_type: "upvote" });
    expect(rv.status).toBe(200);
    expect(rv.body.data.score).toBe(1);

    const list = await request(app).get(`/api/v1/resources/${rid}/reviews`);
    expect(list.status).toBe(200);
    const top = list.body.data.find(
      (r: { id: string }) => r.id === reviewId,
    );
    expect(top.replies.length).toBe(1);
    expect(top.score).toBe(1);

    const bm = await request(app)
      .post(`/api/v1/resources/${rid}/bookmark`)
      .set("Cookie", dave.cookie);
    expect(bm.status).toBe(200);
    const bms = await request(app)
      .get("/api/v1/bookmarks")
      .set("Cookie", dave.cookie);
    expect(bms.body.data.bookmarks.some((b: { id: string }) => b.id === rid)).toBe(
      true,
    );
  });
});
