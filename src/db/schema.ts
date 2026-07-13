import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

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

export const relatedMicroblogs = sqliteTable("related_microblogs", {
  microblogId: text("microblog_id").notNull(),
  relatedMicroblogId: text("related_microblog_id").notNull(),
  score: integer("score").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.microblogId, table.relatedMicroblogId] }),
}));

export type Microblog = typeof microblogs.$inferSelect;
export type NewMicroblog = typeof microblogs.$inferInsert;
