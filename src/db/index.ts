import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

let initPromise: Promise<void> | null = null;

export async function ensureDbInitialized(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS microblogs (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          content_markdown TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          published_at TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          tags TEXT NOT NULL DEFAULT '[]',
          cover_image_url TEXT,
          images TEXT NOT NULL DEFAULT '[]'
        );
      `);
      
      // Add images column to existing installations dynamically
      try {
        await client.execute(`ALTER TABLE microblogs ADD COLUMN images TEXT NOT NULL DEFAULT '[]';`);
      } catch (err) {
        // Column already exists or table alteration not needed
      }
    } catch (err) {
      console.error("Auto DB initialization error:", err);
      // Reset promise to allow retrying on error
      initPromise = null;
    }
  })();

  return initPromise;
}
