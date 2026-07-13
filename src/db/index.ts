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

      await client.execute(`
        CREATE TABLE IF NOT EXISTS related_microblogs (
          microblog_id TEXT NOT NULL,
          related_microblog_id TEXT NOT NULL,
          score INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (microblog_id, related_microblog_id)
        );
      `);
      
      await client.execute(`
        CREATE TABLE IF NOT EXISTS gallery (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          original_url TEXT NOT NULL,
          large_url TEXT NOT NULL,
          medium_url TEXT NOT NULL,
          thumbnail_url TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          file_size INTEGER,
          mime_type TEXT,
          camera TEXT,
          lens TEXT,
          focal_length TEXT,
          aperture TEXT,
          shutter_speed TEXT,
          iso INTEGER,
          taken_at TEXT,
          latitude REAL,
          longitude REAL,
          location_name TEXT,
          visibility TEXT NOT NULL DEFAULT 'public',
          featured INTEGER NOT NULL DEFAULT 0,
          processing_status TEXT NOT NULL DEFAULT 'ready',
          tags TEXT NOT NULL DEFAULT '[]',
          album TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS links (
          slug TEXT PRIMARY KEY,
          url TEXT NOT NULL,
          created_at TEXT NOT NULL,
          click_count INTEGER NOT NULL DEFAULT 0,
          hostname TEXT NOT NULL,
          password TEXT
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS domains (
          hostname TEXT PRIMARY KEY,
          added_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS pastes (
          slug TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          hostname TEXT NOT NULL,
          password TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL
        );
      `);

      // Seed default domain if domains table is empty
      const existingDomains = await client.execute(`SELECT COUNT(*) as count FROM domains;`);
      if (existingDomains.rows[0]?.count === 0) {
        const defaultHost = process.env.SHORTNER_DEFAULT_DOMAIN || "lnk.to";
        await client.execute({
          sql: `INSERT INTO domains (hostname, added_at) VALUES (?, ?);`,
          args: [defaultHost, new Date().toISOString()],
        });
      }

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
