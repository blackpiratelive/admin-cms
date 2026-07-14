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
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          due_date TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          completed INTEGER NOT NULL DEFAULT 0,
          project_id TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1,
          connected INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'disconnected',
          last_sync TEXT,
          last_success TEXT,
          configuration_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS sync_logs (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          duration INTEGER,
          status TEXT NOT NULL,
          items_created INTEGER NOT NULL DEFAULT 0,
          items_updated INTEGER NOT NULL DEFAULT 0,
          items_deleted INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS trakt_movies (
          trakt_id INTEGER PRIMARY KEY,
          tmdb_id INTEGER,
          title TEXT NOT NULL,
          year INTEGER,
          overview TEXT,
          runtime INTEGER,
          rating REAL,
          watched_at TEXT,
          genres TEXT NOT NULL DEFAULT '[]',
          poster_path TEXT,
          backdrop_path TEXT,
          favorite INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          visibility TEXT NOT NULL DEFAULT 'public',
          custom_tags TEXT NOT NULL DEFAULT '[]',
          review TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS trakt_shows (
          trakt_id INTEGER PRIMARY KEY,
          tmdb_id INTEGER,
          title TEXT NOT NULL,
          overview TEXT,
          status TEXT,
          year INTEGER,
          poster_path TEXT,
          backdrop_path TEXT,
          favorite INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          visibility TEXT NOT NULL DEFAULT 'public',
          custom_tags TEXT NOT NULL DEFAULT '[]',
          review TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS trakt_episodes (
          id TEXT PRIMARY KEY,
          show_trakt_id INTEGER NOT NULL,
          episode_number INTEGER NOT NULL,
          season_number INTEGER NOT NULL,
          title TEXT,
          watched_at TEXT,
          rating REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS lastfm_scrobbles (
          id TEXT PRIMARY KEY,
          lastfm_id TEXT,
          artist TEXT NOT NULL,
          album TEXT,
          track TEXT NOT NULL,
          played_at TEXT NOT NULL,
          duration INTEGER,
          mbid TEXT,
          created_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS lastfm_artists (
          artist_name TEXT PRIMARY KEY,
          play_count INTEGER NOT NULL DEFAULT 0,
          last_played TEXT,
          first_played TEXT,
          favorite INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          hidden INTEGER NOT NULL DEFAULT 0,
          review TEXT,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS lastfm_albums (
          id TEXT PRIMARY KEY,
          album_name TEXT NOT NULL,
          artist TEXT NOT NULL,
          play_count INTEGER NOT NULL DEFAULT 0,
          favorite INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          hidden INTEGER NOT NULL DEFAULT 0,
          review TEXT,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS lastfm_tracks (
          id TEXT PRIMARY KEY,
          track_name TEXT NOT NULL,
          artist TEXT NOT NULL,
          play_count INTEGER NOT NULL DEFAULT 0,
          favorite INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          hidden INTEGER NOT NULL DEFAULT 0,
          review TEXT,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS movie_metadata (
          trakt_id INTEGER PRIMARY KEY,
          favorite INTEGER NOT NULL DEFAULT 0,
          personal_rating REAL,
          review TEXT,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          visibility TEXT NOT NULL DEFAULT 'public',
          featured INTEGER NOT NULL DEFAULT 0,
          watched_with TEXT NOT NULL DEFAULT '[]',
          watch_location TEXT,
          related_photos TEXT NOT NULL DEFAULT '[]',
          related_microblogs TEXT NOT NULL DEFAULT '[]',
          related_blog_posts TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS tv_show_metadata (
          trakt_id INTEGER PRIMARY KEY,
          favorite INTEGER NOT NULL DEFAULT 0,
          personal_rating REAL,
          review TEXT,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          visibility TEXT NOT NULL DEFAULT 'public',
          featured INTEGER NOT NULL DEFAULT 0,
          related_photos TEXT NOT NULL DEFAULT '[]',
          related_posts TEXT NOT NULL DEFAULT '[]',
          related_microblogs TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS artist_metadata (
          artist_name TEXT PRIMARY KEY,
          favorite INTEGER NOT NULL DEFAULT 0,
          personal_rating REAL,
          review TEXT,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          visibility TEXT NOT NULL DEFAULT 'public',
          hidden INTEGER NOT NULL DEFAULT 0,
          related_microblogs TEXT NOT NULL DEFAULT '[]',
          related_blog_posts TEXT NOT NULL DEFAULT '[]',
          related_photos TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS album_metadata (
          id TEXT PRIMARY KEY,
          favorite INTEGER NOT NULL DEFAULT 0,
          personal_rating REAL,
          review TEXT,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          visibility TEXT NOT NULL DEFAULT 'public',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS track_metadata (
          id TEXT PRIMARY KEY,
          favorite INTEGER NOT NULL DEFAULT 0,
          loved INTEGER NOT NULL DEFAULT 0,
          personal_rating REAL,
          notes TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          visibility TEXT NOT NULL DEFAULT 'public',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          color TEXT,
          icon TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS collection_items (
          id TEXT PRIMARY KEY,
          collection_id TEXT NOT NULL,
          item_type TEXT NOT NULL,
          item_id TEXT NOT NULL,
          added_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          title TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
      `);

      // Add columns to existing installations dynamically
      try {
        await client.execute(`ALTER TABLE microblogs ADD COLUMN images TEXT NOT NULL DEFAULT '[]';`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE microblogs ADD COLUMN short_url TEXT;`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE gallery ADD COLUMN short_url TEXT;`);
      } catch (err) {}
    } catch (err) {
      console.error("Auto DB initialization error:", err);
      // Reset promise to allow retrying on error
      initPromise = null;
    }
  })();

  return initPromise;
}
