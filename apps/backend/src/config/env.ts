import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default("./.pglite"),

  APP_ORIGIN: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).default("dev-only-session-secret-change-me"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REQUIRE_COLLEGE_EMAIL_DOMAIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  STORAGE_PROVIDER: z.enum(["local", "r2"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads"),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_REGION: z.string().default("auto"),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(20),
  ALLOWED_FILE_EXTENSIONS: z.string().default(".pdf"),
  ALLOWED_MIME_TYPES: z
    .string()
    .default("application/pdf"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",
  allowedOrigins: parsed.data.APP_ORIGIN.split(",").map((o) => o.trim()),
  allowedExtensions: parsed.data.ALLOWED_FILE_EXTENSIONS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  allowedMimeTypes: parsed.data.ALLOWED_MIME_TYPES.split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean),
  maxUploadBytes: parsed.data.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
};
