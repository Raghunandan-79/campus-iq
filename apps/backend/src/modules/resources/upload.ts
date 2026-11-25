import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import multer from "multer";
import { config } from "../../config/env";
import { badRequest } from "../../utils/errors";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
      return cb(badRequest(`File type ${ext || "unknown"} is not allowed`));
    }
    cb(null, true);
  },
});

export const uploadSingle = upload.single("file");

/** Basic content inspection: verify PDF magic bytes for .pdf uploads. */
export function validateFileContent(
  buffer: Buffer,
  originalname: string,
): { ok: boolean; mimeType: string } {
  const ext = path.extname(originalname).toLowerCase();
  const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (ext === ".pdf" && !isPdf) {
    return { ok: false, mimeType: "application/pdf" };
  }
  return { ok: true, mimeType: "application/pdf" };
}

export function generateStorageKey(userId: string, originalname: string) {
  const ext = path.extname(originalname).toLowerCase() || ".bin";
  const safeExt = config.allowedExtensions.includes(ext) ? ext : ".bin";
  return `resources/${userId}/${crypto.randomUUID()}${safeExt}`;
}

export function bufferToStream(buffer: Buffer): Readable {
  return Readable.from(buffer);
}
