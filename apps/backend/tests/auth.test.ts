import { describe, expect, it } from "vitest";
import request from "supertest";
import { login, setupApp, signup } from "./helpers";

describe("auth", () => {
  it("signs up, logs in, reads /me, logs out", async () => {
    const { app, collegeId } = await setupApp();

    const su = await signup(app, "alice@test.dev", collegeId);
    expect(su.status).toBe(200);
    expect(su.body.data.user.email).toBe("alice@test.dev");
    expect(su.body.data.user.role).toBe("student");
    const cookie = su.headers["set-cookie"];
    expect(cookie?.[0]).toContain("HttpOnly");

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie as unknown as string[]);
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(su.body.data.user.id);

    const lo = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookie as unknown as string[]);
    expect(lo.status).toBe(200);

    const meAfter = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookie as unknown as string[]);
    expect(meAfter.status).toBe(401);
  });

  it("rejects duplicate signup and bad login", async () => {
    const { app } = await setupApp();
    await signup(app, "bob@test.dev");
    const dup = await signup(app, "bob@test.dev");
    expect(dup.status).toBe(409);

    const bad = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "bob@test.dev", password: "wrong-password" });
    expect(bad.status).toBe(401);
  });

  it("protects routes without a session", async () => {
    const { app } = await setupApp();
    const res = await request(app).get("/api/v1/users/me");
    expect(res.status).toBe(401);
  });
});
