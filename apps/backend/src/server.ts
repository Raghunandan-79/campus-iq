import { createApp } from "./app";
import { config } from "./config/env";
import { getDb } from "./db";
import { logger } from "./utils/logger";

async function main() {
  await getDb(); // runs migrations on boot
  if (config.AUTO_SEED === "true") {
    const { runSeed } = await import("./db/seed");
    await runSeed();
    logger.info("auto_seed_complete");
  }
  if (config.ADMIN_EMAIL) {
    const { eq } = await import("drizzle-orm");
    const { users } = await import("./db/schema");
    const db = await getDb();
    const promoted = await db
      .update(users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(users.email, config.ADMIN_EMAIL))
      .returning({ id: users.id });
    if (promoted.length > 0) {
      logger.info("admin_promoted", { email: config.ADMIN_EMAIL });
    } else {
      logger.warn("admin_email_not_found", {
        email: config.ADMIN_EMAIL,
        hint: "sign up on the site first, then restart",
      });
    }
  }
  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info("server_started", {
      port: config.PORT,
      env: config.NODE_ENV,
      db: config.DATABASE_URL ? "postgres" : "pglite",
      storage: config.STORAGE_PROVIDER,
    });
  });
}

main().catch((e) => {
  logger.error("startup_failed", { error: String(e) });
  process.exit(1);
});
