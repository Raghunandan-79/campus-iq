import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config/env";
import { optionalAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/common";
import adminRouter from "./modules/admin/routes";
import authRouter from "./modules/auth/routes";
import bookmarksRouter from "./modules/bookmarks/routes";
import collegesRouter, {
  collegeReviewsRouter,
  moderationRouter,
} from "./modules/colleges/routes";
import healthRouter from "./modules/health/routes";
import resourcesRouter from "./modules/resources/routes";
import reviewsRouter from "./modules/reviews/routes";
import subjectsRouter from "./modules/subjects/routes";
import usersRouter from "./modules/users/routes";
import { fail } from "./utils/http";
import { logger } from "./utils/logger";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin/no-origin requests (curl, server-to-server).
        if (!origin || config.allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // Simple structured request logging.
  app.use((req, _res, next) => {
    const start = Date.now();
    _res.on("finish", () => {
      logger.info("request", {
        method: req.method,
        path: req.path,
        status: _res.statusCode,
        ms: Date.now() - start,
      });
    });
    next();
  });

  // Origin enforcement for state-changing requests (CSRF defense in depth;
  // session cookie is SameSite=Lax + HttpOnly).
  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !config.allowedOrigins.includes(origin)) {
      return fail(res, 403, "forbidden_origin", "Origin not allowed");
    }
    next();
  });

  const globalLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authLimiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/v1/auth", authLimiter);
  app.use("/api/v1", globalLimiter);
  app.use(optionalAuth);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/health", healthRouter);

  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/admin", adminRouter);
  v1.use("/users", usersRouter);
  v1.use("/colleges", collegesRouter);
  v1.use("/college-reviews", collegeReviewsRouter);
  v1.use("/moderation", moderationRouter);
  v1.use("/subjects", subjectsRouter);
  v1.use("/resources", resourcesRouter);
  v1.use("/reviews", reviewsRouter);
  v1.use("/bookmarks", bookmarksRouter);
  app.use("/api/v1", v1);

  app.use((_req, res) => {
    fail(res, 404, "not_found", "Route not found");
  });

  app.use(errorHandler);
  return app;
}
