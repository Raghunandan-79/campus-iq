import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError, badRequest } from "../utils/errors";
import { fail } from "../utils/http";
import { logger } from "../utils/logger";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        next(badRequest("Validation failed", e.flatten()));
      } else next(e);
    }
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      (req as Request & { validatedQuery: T }).validatedQuery =
        schema.parse(req.query);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        next(badRequest("Invalid query parameters", e.flatten()));
      } else next(e);
    }
  };
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return fail(res, err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return fail(res, 400, "bad_request", "Validation failed", err.flatten());
  }
  // Multer errors
  const e = err as { code?: string; message?: string };
  if (e?.code === "LIMIT_FILE_SIZE") {
    return fail(res, 413, "file_too_large", "File exceeds the maximum upload size");
  }
  if (e?.code === "LIMIT_UNEXPECTED_FILE") {
    return fail(res, 400, "bad_request", "Unexpected file field");
  }
  logger.error("unhandled_error", {
    path: req.path,
    method: req.method,
    error: e?.message ?? String(err),
  });
  return fail(res, 500, "internal_error", "Something went wrong");
}
