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

      await client.execute(`
        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          country TEXT,
          state TEXT,
          city TEXT,
          latitude REAL,
          longitude REAL,
          elevation REAL,
          timezone TEXT,
          first_visited TEXT,
          last_visited TEXT,
          visit_count INTEGER NOT NULL DEFAULT 1,
          private_notes TEXT,
          public_description TEXT,
          tags TEXT NOT NULL DEFAULT '[]',
          visibility TEXT NOT NULL DEFAULT 'public',
          favorite INTEGER NOT NULL DEFAULT 0,
          photography_notes TEXT,
          parking_notes TEXT,
          walking_difficulty TEXT,
          weather_notes TEXT,
          best_season TEXT,
          best_time_of_day TEXT,
          camera_recommendations TEXT,
          personal_rating REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS trips (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          start_date TEXT,
          end_date TEXT,
          status TEXT NOT NULL DEFAULT 'planned',
          visibility TEXT NOT NULL DEFAULT 'public',
          favorite INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS persons (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          first_name TEXT,
          last_name TEXT,
          nickname TEXT,
          slug TEXT NOT NULL UNIQUE,
          avatar_url TEXT,
          relationship_type TEXT,
          important_dates_json TEXT NOT NULL DEFAULT '[]',
          notes_markdown TEXT,
          interests TEXT NOT NULL DEFAULT '[]',
          social_links_json TEXT NOT NULL DEFAULT '{}',
          visibility TEXT NOT NULL DEFAULT 'private',
          favorite INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          color TEXT,
          created_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS entity_tags (
          id TEXT PRIMARY KEY,
          tag_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS relationships (
          id TEXT PRIMARY KEY,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          relationship TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          url TEXT NOT NULL,
          mime TEXT,
          width INTEGER,
          height INTEGER,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'queued',
          progress INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          result_json TEXT NOT NULL DEFAULT '{}',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          content_markdown TEXT NOT NULL,
          visibility TEXT NOT NULL DEFAULT 'private',
          favorite INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          visibility TEXT NOT NULL DEFAULT 'public',
          favorite INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS quotes (
          id TEXT PRIMARY KEY,
          quote TEXT NOT NULL,
          author TEXT,
          source TEXT,
          visibility TEXT NOT NULL DEFAULT 'public',
          favorite INTEGER NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS dashboard_cache (
          key TEXT PRIMARY KEY,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS search_index (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          title TEXT NOT NULL,
          subtitle TEXT,
          keywords TEXT NOT NULL DEFAULT '',
          url TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS system_stats (
          key TEXT PRIMARY KEY,
          data_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Add columns to existing installations dynamically
      try {
        await client.execute(`ALTER TABLE microblogs ADD COLUMN location_id TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE microblogs ADD COLUMN trip_id TEXT;`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE gallery ADD COLUMN location_id TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE gallery ADD COLUMN trip_id TEXT;`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE movie_metadata ADD COLUMN location_id TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE movie_metadata ADD COLUMN trip_id TEXT;`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN slug TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN repository_url TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN website_url TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN technologies TEXT NOT NULL DEFAULT '[]';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN start_date TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN completed_date TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE lastfm_albums ADD COLUMN last_played TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE lastfm_albums ADD COLUMN first_played TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE lastfm_tracks ADD COLUMN last_played TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE lastfm_tracks ADD COLUMN first_played TEXT;`);
      } catch (err) {}

      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN display_name TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN name TEXT NOT NULL DEFAULT '';`);
      } catch (err) {}
      try {
        await client.execute(`UPDATE persons SET display_name = name WHERE (display_name IS NULL OR display_name = '') AND name IS NOT NULL AND name != '';`);
      } catch (err) {}
      try {
        await client.execute(`UPDATE persons SET name = display_name WHERE (name IS NULL OR name = '') AND display_name IS NOT NULL AND display_name != '';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN first_name TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN last_name TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN nickname TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN relationship_type TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN important_dates_json TEXT NOT NULL DEFAULT '[]';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN notes_markdown TEXT;`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN interests TEXT NOT NULL DEFAULT '[]';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN social_links_json TEXT NOT NULL DEFAULT '{}';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';`);
      } catch (err) {}
      try {
        await client.execute(`ALTER TABLE persons ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;`);
      } catch (err) {}

      // Comprehensive performance indexes covering all single-column & multi-column queries
      await client.executeMultiple(`
        CREATE INDEX IF NOT EXISTS microblogs_created_at_idx ON microblogs(created_at DESC);
        CREATE INDEX IF NOT EXISTS microblogs_status_created_at_idx ON microblogs(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS microblogs_slug_idx ON microblogs(slug);
        CREATE INDEX IF NOT EXISTS gallery_created_at_idx ON gallery(created_at DESC);
        CREATE INDEX IF NOT EXISTS gallery_visibility_idx ON gallery(visibility);
        CREATE INDEX IF NOT EXISTS gallery_location_trip_idx ON gallery(location_id, trip_id);
        CREATE INDEX IF NOT EXISTS todos_completed_due_date_idx ON todos(completed, due_date);
        CREATE INDEX IF NOT EXISTS trakt_movies_watched_at_idx ON trakt_movies(watched_at DESC);
        CREATE INDEX IF NOT EXISTS trakt_shows_updated_at_idx ON trakt_shows(updated_at DESC);
        CREATE INDEX IF NOT EXISTS trakt_episodes_show_id_idx ON trakt_episodes(show_trakt_id);
        CREATE INDEX IF NOT EXISTS lastfm_scrobbles_played_at_idx ON lastfm_scrobbles(played_at DESC);
        CREATE INDEX IF NOT EXISTS persons_slug_idx ON persons(slug);
        CREATE INDEX IF NOT EXISTS persons_created_at_idx ON persons(created_at DESC);
        CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(created_at DESC);
        CREATE INDEX IF NOT EXISTS locations_slug_idx ON locations(slug);
        CREATE INDEX IF NOT EXISTS trips_slug_idx ON trips(slug);
        CREATE INDEX IF NOT EXISTS relationships_source_idx ON relationships(source_type, source_id);
        CREATE INDEX IF NOT EXISTS relationships_target_idx ON relationships(target_type, target_id);
        CREATE INDEX IF NOT EXISTS attachments_entity_idx ON attachments(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS collection_items_col_idx ON collection_items(collection_id, item_type, item_id);
        CREATE INDEX IF NOT EXISTS search_index_query_idx ON search_index(title, subtitle, keywords);
      `);

      // SQLite maintenance optimization & query planner statistics
      try {
        await client.execute(`PRAGMA optimize;`);
        await client.execute(`ANALYZE;`);
      } catch (mErr) {}
    } catch (err) {
      console.error("Auto DB initialization error:", err);
      // Reset promise to allow retrying on error
      initPromise = null;
    }
  })();

  return initPromise;
}
