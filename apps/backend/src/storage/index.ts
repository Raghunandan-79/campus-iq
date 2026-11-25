import { config } from "../config/env";
import { LocalStorageProvider } from "./local";
import { R2StorageProvider } from "./r2";
import type { StorageProvider } from "./types";

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!provider) {
    provider =
      config.STORAGE_PROVIDER === "r2"
        ? new R2StorageProvider()
        : new LocalStorageProvider();
  }
  return provider;
}

export type { StorageProvider } from "./types";
