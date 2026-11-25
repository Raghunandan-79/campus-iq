import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import {
  drizzle as drizzlePg,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../config/env";
import { schema } from "./schema";

const MIGRATIONS_FOLDER = "./drizzle";

// Both drivers expose the same Drizzle query API; we type the handle as the
// Postgres.js variant and cast the PGlite instance (identical surface).
export type Db = PostgresJsDatabase<typeof schema>;

let db: Db;
let client: postgres.Sql | PGlite | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  if (config.DATABASE_URL) {
    const sql = postgres(config.DATABASE_URL, { max: 10 });
    client = sql;
    const instance = drizzlePg(sql, { schema });
    await migratePg(instance, { migrationsFolder: MIGRATIONS_FOLDER });
    db = instance;
  } else {
    // Local development fallback: embedded Postgres (PGlite), zero credentials.
    const pglite = new PGlite(config.PGLITE_DIR);
    client = pglite;
    const instance = drizzlePglite(pglite, { schema });
    await migratePglite(instance, { migrationsFolder: MIGRATIONS_FOLDER });
    db = instance as unknown as Db;
  }
  return db;
}

export function getClient() {
  return client;
}
