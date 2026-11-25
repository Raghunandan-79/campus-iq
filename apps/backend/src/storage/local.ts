import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { config } from "../config/env";
import type { StorageProvider, StorageUploadInput } from "./types";

/**
 * Resolves a storage key to an absolute path inside the local storage dir.
 * Rejects path traversal attempts.
 */
function resolveKey(key: string): string {
  const root = path.resolve(config.STORAGE_LOCAL_DIR);
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(input: StorageUploadInput): Promise<void> {
    const filePath = resolveKey(input.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    try {
      await pipeline(input.body, createWriteStream(tmpPath));
      await rename(tmpPath, filePath);
    } catch (e) {
      await rm(tmpPath, { force: true }).catch(() => {});
      throw e;
    }
  }

  async download(key: string): Promise<Readable> {
    const filePath = resolveKey(key);
    const s = await stat(filePath);
    if (!s.isFile()) throw new Error("File not found");
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKey(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      const s = await stat(resolveKey(key));
      return s.isFile();
    } catch {
      return false;
    }
  }
}

