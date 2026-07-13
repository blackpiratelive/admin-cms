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

export type Microblog = typeof microblogs.$inferSelect;
export type NewMicroblog = typeof microblogs.$inferInsert;

export type GalleryPhoto = typeof gallery.$inferSelect;
export type NewGalleryPhoto = typeof gallery.$inferInsert;

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



