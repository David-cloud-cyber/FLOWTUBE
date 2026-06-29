import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

let cachedDb: PostgresJsDatabase<typeof schema> | null = null;

export function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (cachedDb) return cachedDb;

  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false
  });

  cachedDb = drizzle(client, { schema });
  return cachedDb;
}
