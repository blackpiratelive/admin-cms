import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});

export type Microblog = typeof microblogs.$inferSelect;
export type NewMicroblog = typeof microblogs.$inferInsert;
