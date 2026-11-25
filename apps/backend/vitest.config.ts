import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      PGLITE_DIR: "./.pglite-test",
      STORAGE_LOCAL_DIR: "./.uploads-test",
      SESSION_SECRET: "test-session-secret-0123456789",
      APP_ORIGIN: "http://localhost:3000",
    },
    testTimeout: 30000,
    hookTimeout: 60000,
    // PGlite is single-writer; run test files sequentially in one process.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ["./tests/globalSetup.ts"],
  },
});
