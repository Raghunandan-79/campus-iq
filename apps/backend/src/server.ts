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
