import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const microblogs = sqliteTable("microblogs", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  contentMarkdown: text("content_markdown").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
  status: text("status", { enum: ["draft", "published", "scheduled", "archived"] }).notNull().default("draft"),
  tags: text("tags").notNull().default("[]"),
  coverImageUrl: text("cover_image_url"),
  images: text("images").notNull().default("[]"),
  shortUrl: text("short_url"),
});

export const relatedMicroblogs = sqliteTable("related_microblogs", {
  microblogId: text("microblog_id").notNull(),
  relatedMicroblogId: text("related_microblog_id").notNull(),
  score: integer("score").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.microblogId, table.relatedMicroblogId] }),
}));

export const gallery = sqliteTable("gallery", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  originalUrl: text("original_url").notNull(),
  largeUrl: text("large_url").notNull(),
  mediumUrl: text("medium_url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  width: integer("width"),
  height: integer("height"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  camera: text("camera"),
  lens: text("lens"),
  focalLength: text("focal_length"),
  aperture: text("aperture"),
  shutterSpeed: text("shutter_speed"),
  iso: integer("iso"),
  takenAt: text("taken_at"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationName: text("location_name"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("public"),
  featured: integer("featured").notNull().default(0),
  processingStatus: text("processing_status", { enum: ["pending", "processing", "ready", "failed"] }).notNull().default("ready"),
  tags: text("tags").notNull().default("[]"),
  album: text("album"),
  shortUrl: text("short_url"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  completed: integer("completed").notNull().default(0),
  projectId: text("project_id"),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// --- SYNC CENTER SCHEMAS ---

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(), // slug e.g. "trakt", "lastfm"
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  enabled: integer("enabled").notNull().default(1),
  connected: integer("connected").notNull().default(0),
  status: text("status", { enum: ["connected", "disconnected", "syncing", "error", "disabled"] }).notNull().default("disconnected"),
  lastSync: text("last_sync"),
  lastSuccess: text("last_success"),
  configurationJson: text("configuration_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const syncLogs = sqliteTable("sync_logs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  duration: integer("duration"), // ms
  status: text("status", { enum: ["success", "failed", "in_progress", "partial"] }).notNull(),
  itemsCreated: integer("items_created").notNull().default(0),
  itemsUpdated: integer("items_updated").notNull().default(0),
  itemsDeleted: integer("items_deleted").notNull().default(0),
  errorMessage: text("error_message"),
  metadataJson: text("metadata_json").notNull().default("{}"),
});

// Trakt Tables
export const traktMovies = sqliteTable("trakt_movies", {
  traktId: integer("trakt_id").primaryKey(),
  tmdbId: integer("tmdb_id"),
  title: text("title").notNull(),
  year: integer("year"),
  overview: text("overview"),
  runtime: integer("runtime"),
  rating: real("rating"),
  watchedAt: text("watched_at"),
  genres: text("genres").notNull().default("[]"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  // Personal Metadata (Preserved during sync)
  favorite: integer("favorite").notNull().default(0),
  notes: text("notes"),
  visibility: text("visibility").notNull().default("public"),
  customTags: text("custom_tags").notNull().default("[]"),
  review: text("review"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const traktShows = sqliteTable("trakt_shows", {
  traktId: integer("trakt_id").primaryKey(),
  tmdbId: integer("tmdb_id"),
  title: text("title").notNull(),
  overview: text("overview"),
  status: text("status"),
  year: integer("year"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  // Personal Metadata (Preserved during sync)
  favorite: integer("favorite").notNull().default(0),
  notes: text("notes"),
  visibility: text("visibility").notNull().default("public"),
  customTags: text("custom_tags").notNull().default("[]"),
  review: text("review"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const traktEpisodes = sqliteTable("trakt_episodes", {
  id: text("id").primaryKey(), // ${showTraktId}_s${seasonNumber}_e${episodeNumber}
  showTraktId: integer("show_trakt_id").notNull(),
  episodeNumber: integer("episode_number").notNull(),
  seasonNumber: integer("season_number").notNull(),
  title: text("title"),
  watchedAt: text("watched_at"),
  rating: real("rating"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Last.fm Tables
export const lastfmScrobbles = sqliteTable("lastfm_scrobbles", {
  id: text("id").primaryKey(), // ${uts}_${artist}_${track}
  lastfmId: text("lastfm_id"),
  artist: text("artist").notNull(),
  album: text("album"),
  track: text("track").notNull(),
  playedAt: text("played_at").notNull(),
  duration: integer("duration"),
  mbid: text("mbid"),
  createdAt: text("created_at").notNull(),
});

export const lastfmArtists = sqliteTable("lastfm_artists", {
  artistName: text("artist_name").primaryKey(),
  playCount: integer("play_count").notNull().default(0),
  lastPlayed: text("last_played"),
  firstPlayed: text("first_played"),
  // Personal Metadata (Preserved during sync)
  favorite: integer("favorite").notNull().default(0),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  hidden: integer("hidden").notNull().default(0),
  review: text("review"),
  updatedAt: text("updated_at").notNull(),
});

export const lastfmAlbums = sqliteTable("lastfm_albums", {
  id: text("id").primaryKey(), // ${artist}:::${albumName}
  albumName: text("album_name").notNull(),
  artist: text("artist").notNull(),
  playCount: integer("play_count").notNull().default(0),
  // Personal Metadata (Preserved during sync)
  favorite: integer("favorite").notNull().default(0),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  hidden: integer("hidden").notNull().default(0),
  review: text("review"),
  updatedAt: text("updated_at").notNull(),
});

export const lastfmTracks = sqliteTable("lastfm_tracks", {
  id: text("id").primaryKey(), // ${artist}:::${trackName}
  trackName: text("track_name").notNull(),
  artist: text("artist").notNull(),
  playCount: integer("play_count").notNull().default(0),
  // Personal Metadata (Preserved during sync)
  favorite: integer("favorite").notNull().default(0),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  hidden: integer("hidden").notNull().default(0),
  review: text("review"),
  updatedAt: text("updated_at").notNull(),
});

export type Microblog = typeof microblogs.$inferSelect;
export type NewMicroblog = typeof microblogs.$inferInsert;

export type GalleryPhoto = typeof gallery.$inferSelect;
export type NewGalleryPhoto = typeof gallery.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Todo = typeof todos.$inferSelect;

export type ProviderRecord = typeof providers.$inferSelect;
export type SyncLogRecord = typeof syncLogs.$inferSelect;
export type TraktMovieRecord = typeof traktMovies.$inferSelect;
export type TraktShowRecord = typeof traktShows.$inferSelect;
export type TraktEpisodeRecord = typeof traktEpisodes.$inferSelect;
export type LastfmScrobbleRecord = typeof lastfmScrobbles.$inferSelect;
export type LastfmArtistRecord = typeof lastfmArtists.$inferSelect;
export type LastfmAlbumRecord = typeof lastfmAlbums.$inferSelect;
export type LastfmTrackRecord = typeof lastfmTracks.$inferSelect;

export interface ShortLink {
  slug: string;
  url: string;
  createdAt: string;
  clickCount: number;
  hostname: string;
  password?: string | null;
}

export interface ShortDomain {
  hostname: string;
  addedAt: string;
}

export interface PasteItem {
  slug: string;
  content: string;
  hostname: string;
  password?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}



