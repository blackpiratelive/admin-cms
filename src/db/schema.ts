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
  locationId: text("location_id"),
  tripId: text("trip_id"),
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
  locationId: text("location_id"),
  tripId: text("trip_id"),
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
  slug: text("slug"),
  description: text("description"),
  repositoryUrl: text("repository_url"),
  websiteUrl: text("website_url"),
  status: text("status", { enum: ["active", "completed", "archived", "on_hold", "planned"] }).notNull().default("active"),
  technologies: text("technologies").notNull().default("[]"),
  startDate: text("start_date"),
  completedDate: text("completed_date"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("public"),
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

// --- CORE KNOWLEDGE PLATFORM ENTITIES ---

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  country: text("country"),
  state: text("state"),
  city: text("city"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  elevation: real("elevation"),
  timezone: text("timezone"),
  firstVisited: text("first_visited"),
  lastVisited: text("last_visited"),
  visitCount: integer("visit_count").notNull().default(1),
  privateNotes: text("private_notes"),
  publicDescription: text("public_description"),
  tags: text("tags").notNull().default("[]"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("public"),
  favorite: integer("favorite").notNull().default(0),
  photographyNotes: text("photography_notes"),
  parkingNotes: text("parking_notes"),
  walkingDifficulty: text("walking_difficulty"),
  weatherNotes: text("weather_notes"),
  bestSeason: text("best_season"),
  bestTimeOfDay: text("best_time_of_day"),
  cameraRecommendations: text("camera_recommendations"),
  personalRating: real("personal_rating"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trips = sqliteTable("trips", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status", { enum: ["planned", "ongoing", "completed", "cancelled"] }).notNull().default("planned"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("public"),
  favorite: integer("favorite").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const persons = sqliteTable("persons", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  name: text("name").notNull().default(""),
  firstName: text("first_name"),
  lastName: text("last_name"),
  nickname: text("nickname"),
  slug: text("slug").notNull().unique(),
  avatarUrl: text("avatar_url"),
  relationshipType: text("relationship_type"),
  importantDatesJson: text("important_dates_json").notNull().default("[]"),
  notesMarkdown: text("notes_markdown"),
  interests: text("interests").notNull().default("[]"),
  socialLinksJson: text("social_links_json").notNull().default("{}"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("private"),
  favorite: integer("favorite").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});


export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(), // slug identifier
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: text("created_at").notNull(),
});

export const entityTags = sqliteTable("entity_tags", {
  id: text("id").primaryKey(), // ${tagId}_${entityType}_${entityId}
  tagId: text("tag_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const relationships = sqliteTable("relationships", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  relationship: text("relationship").notNull(), // 'taken_at', 'watched_at', 'belongs_to', 'mentions', 'contains', 'related_to', 'references'
  createdAt: text("created_at").notNull(),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  kind: text("kind").notNull(), // 'screenshot', 'poster', 'cover', 'hero', 'gallery_ref', 'video', 'pdf', 'file'
  url: text("url").notNull(),
  mime: text("mime"),
  width: integer("width"),
  height: integer("height"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  status: text("status", { enum: ["queued", "running", "completed", "failed", "cancelled"] }).notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  errorMessage: text("error_message"),
  resultJson: text("result_json").notNull().default("{}"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  createdAt: text("created_at").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  contentMarkdown: text("content_markdown").notNull(),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("private"),
  favorite: integer("favorite").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("public"),
  favorite: integer("favorite").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  quote: text("quote").notNull(),
  author: text("author"),
  source: text("source"),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("public"),
  favorite: integer("favorite").notNull().default(0),
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

export const lastfmTracks = sqliteTable("lastfm_tracks", {
  id: text("id").primaryKey(), // ${artist}:::${trackName}
  trackName: text("track_name").notNull(),
  artist: text("artist").notNull(),
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

// CMS Dedicated Personal Metadata Tables
export const movieMetadata = sqliteTable("movie_metadata", {
  traktId: integer("trakt_id").primaryKey(),
  favorite: integer("favorite").notNull().default(0),
  personalRating: real("personal_rating"),
  review: text("review"),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  visibility: text("visibility").notNull().default("public"),
  featured: integer("featured").notNull().default(0),
  watchedWith: text("watched_with").notNull().default("[]"),
  watchLocation: text("watch_location"),
  locationId: text("location_id"),
  tripId: text("trip_id"),
  relatedPhotos: text("related_photos").notNull().default("[]"),
  relatedMicroblogs: text("related_microblogs").notNull().default("[]"),
  relatedBlogPosts: text("related_blog_posts").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tvShowMetadata = sqliteTable("tv_show_metadata", {
  traktId: integer("trakt_id").primaryKey(),
  favorite: integer("favorite").notNull().default(0),
  personalRating: real("personal_rating"),
  review: text("review"),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  visibility: text("visibility").notNull().default("public"),
  featured: integer("featured").notNull().default(0),
  relatedPhotos: text("related_photos").notNull().default("[]"),
  relatedPosts: text("related_posts").notNull().default("[]"),
  relatedMicroblogs: text("related_microblogs").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const artistMetadata = sqliteTable("artist_metadata", {
  artistName: text("artist_name").primaryKey(),
  favorite: integer("favorite").notNull().default(0),
  personalRating: real("personal_rating"),
  review: text("review"),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  visibility: text("visibility").notNull().default("public"),
  hidden: integer("hidden").notNull().default(0),
  relatedMicroblogs: text("related_microblogs").notNull().default("[]"),
  relatedBlogPosts: text("related_blog_posts").notNull().default("[]"),
  relatedPhotos: text("related_photos").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const albumMetadata = sqliteTable("album_metadata", {
  id: text("id").primaryKey(), // ${artist}:::${albumName}
  favorite: integer("favorite").notNull().default(0),
  personalRating: real("personal_rating"),
  review: text("review"),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  visibility: text("visibility").notNull().default("public"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const trackMetadata = sqliteTable("track_metadata", {
  id: text("id").primaryKey(), // ${artist}:::${trackName}
  favorite: integer("favorite").notNull().default(0),
  loved: integer("loved").notNull().default(0),
  personalRating: real("personal_rating"),
  notes: text("notes"),
  tags: text("tags").notNull().default("[]"),
  visibility: text("visibility").notNull().default("public"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Generic Collections
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color"),
  icon: text("icon"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const collectionItems = sqliteTable("collection_items", {
  id: text("id").primaryKey(), // ${collectionId}_${itemType}_${itemId}
  collectionId: text("collection_id").notNull(),
  itemType: text("item_type").notNull(), // 'movie' | 'show' | 'artist' | 'album' | 'track' | 'book' | 'project' | 'photo' | 'location' | 'trip' | 'note' | 'bookmark' | 'quote'
  itemId: text("item_id").notNull(),
  addedAt: text("added_at").notNull(),
});

// Activity Timeline Stream
export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  action: text("action").notNull(), // 'microblog_published', 'photo_uploaded', 'location_created', 'trip_completed', 'movie_watched', 'review_written', etc.
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export type Microblog = typeof microblogs.$inferSelect;
export type NewMicroblog = typeof microblogs.$inferInsert;

export type GalleryPhoto = typeof gallery.$inferSelect;
export type NewGalleryPhoto = typeof gallery.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Todo = typeof todos.$inferSelect;

export type LocationRecord = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type TripRecord = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type PersonRecord = typeof persons.$inferSelect;
export type NewPerson = typeof persons.$inferInsert;
export type TagRecord = typeof tags.$inferSelect;
export type EntityTagRecord = typeof entityTags.$inferSelect;
export type RelationshipRecord = typeof relationships.$inferSelect;
export type AttachmentRecord = typeof attachments.$inferSelect;
export type JobRecord = typeof jobs.$inferSelect;
export type NoteRecord = typeof notes.$inferSelect;
export type BookmarkRecord = typeof bookmarks.$inferSelect;
export type QuoteRecord = typeof quotes.$inferSelect;

export type ProviderRecord = typeof providers.$inferSelect;
export type SyncLogRecord = typeof syncLogs.$inferSelect;
export type TraktMovieRecord = typeof traktMovies.$inferSelect;
export type TraktShowRecord = typeof traktShows.$inferSelect;
export type TraktEpisodeRecord = typeof traktEpisodes.$inferSelect;
export type LastfmScrobbleRecord = typeof lastfmScrobbles.$inferSelect;
export type LastfmArtistRecord = typeof lastfmArtists.$inferSelect;
export type LastfmAlbumRecord = typeof lastfmAlbums.$inferSelect;
export type LastfmTrackRecord = typeof lastfmTracks.$inferSelect;

export type MovieMetadataRecord = typeof movieMetadata.$inferSelect;
export type TvShowMetadataRecord = typeof tvShowMetadata.$inferSelect;
export type ArtistMetadataRecord = typeof artistMetadata.$inferSelect;
export type AlbumMetadataRecord = typeof albumMetadata.$inferSelect;
export type TrackMetadataRecord = typeof trackMetadata.$inferSelect;
export type CollectionRecord = typeof collections.$inferSelect;
export type CollectionItemRecord = typeof collectionItems.$inferSelect;
export type ActivityRecord = typeof activities.$inferSelect;

export const dashboardCache = sqliteTable("dashboard_cache", {
  key: text("key").primaryKey(),
  dataJson: text("data_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const searchIndex = sqliteTable("search_index", {
  id: text("id").primaryKey(), // `${entityType}_${entityId}`
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  keywords: text("keywords").notNull().default(""),
  url: text("url").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const systemStats = sqliteTable("system_stats", {
  key: text("key").primaryKey(), // e.g. "counts", "movie_stats", "artist_stats", "location_stats", "trip_stats"
  dataJson: text("data_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type DashboardCacheRecord = typeof dashboardCache.$inferSelect;
export type SearchIndexRecord = typeof searchIndex.$inferSelect;
export type SystemStatsRecord = typeof systemStats.$inferSelect;

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

// --- E2EE JOURNAL MODULE SCHEMAS ---
export const journalEntries = sqliteTable("journal_entries", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  entryDate: text("entry_date").notNull(),
  entryType: text("entry_type").notNull().default("daily"),
  mood: text("mood"),
  favorite: integer("favorite").notNull().default(0),
  visibility: text("visibility", { enum: ["public", "private", "unlisted"] }).notNull().default("private"),
  locationId: text("location_id"),
  tripId: text("trip_id"),
  weatherId: text("weather_id"),
  encryptedContent: text("encrypted_content").notNull(),
  encryptionVersion: integer("encryption_version").notNull().default(1),
  iv: text("iv").notNull(),
  salt: text("salt").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  readingTime: integer("reading_time").notNull().default(0),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const journalRevisions = sqliteTable("journal_revisions", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull(),
  encryptedContent: text("encrypted_content").notNull(),
  iv: text("iv").notNull(),
  salt: text("salt").notNull(),
  createdAt: text("created_at").notNull(),
});

export const journalSettings = sqliteTable("journal_settings", {
  id: text("id").primaryKey(),
  salt: text("salt").notNull(),
  verificationPayload: text("verification_payload").notNull(),
  verificationIv: text("verification_iv").notNull(),
  autoLockMinutes: integer("auto_lock_minutes").notNull().default(15),
  updatedAt: text("updated_at").notNull(),
});

export const journalKeys = sqliteTable("journal_keys", {
  id: text("id").primaryKey(), // 'default'
  encryptedDek: text("encrypted_dek").notNull(),
  salt: text("salt").notNull(),
  iv: text("iv").notNull(),
  algorithm: text("algorithm").notNull().default("AES-256-GCM"),
  kdf: text("kdf").notNull().default("Argon2id"),
  argonMemory: integer("argon_memory").notNull().default(65536),
  argonIterations: integer("argon_iterations").notNull().default(3),
  argonParallelism: integer("argon_parallelism").notNull().default(1),
  keyVersion: integer("key_version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const journalAssets = sqliteTable("journal_assets", {
  id: text("id").primaryKey(),
  assetType: text("asset_type").notNull().default("image"),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  width: integer("width").notNull().default(0),
  height: integer("height").notNull().default(0),
  originalSize: integer("original_size").notNull().default(0),
  compressedSize: integer("compressed_size").notNull().default(0),
  thumbnailSize: integer("thumbnail_size").notNull().default(0),
  cloudinaryOriginalPublicId: text("cloudinary_original_public_id").notNull(),
  cloudinaryThumbnailPublicId: text("cloudinary_thumbnail_public_id").notNull(),
  originalIv: text("original_iv").notNull(),
  thumbnailIv: text("thumbnail_iv").notNull(),
  encryptionVersion: integer("encryption_version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const journalEntryAssets = sqliteTable("journal_entry_assets", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull(),
  assetId: text("asset_id").notNull(),
  assetRole: text("asset_role").notNull().default("attachment"), // 'inline' | 'attachment'
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export type JournalEntryRecord = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type JournalRevisionRecord = typeof journalRevisions.$inferSelect;
export type JournalSettingsRecord = typeof journalSettings.$inferSelect;
export type JournalKeyRecord = typeof journalKeys.$inferSelect;
export type JournalAssetRecord = typeof journalAssets.$inferSelect;
export type NewJournalAsset = typeof journalAssets.$inferInsert;
export type JournalEntryAssetRecord = typeof journalEntryAssets.$inferSelect;







