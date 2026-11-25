import type { Readable } from "node:stream";

export interface StorageUploadInput {
  key: string;
  body: Readable;
  contentType: string;
  contentLength?: number;
}

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<void>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
