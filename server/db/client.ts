import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cached: PostgresJsDatabase<typeof schema> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (cached) return cached;

  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false
  });
  cached = drizzle(client, { schema });
  return cached;
}
