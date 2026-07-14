import { z } from "zod";

export const microblogStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

export const microblogInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  contentMarkdown: z.string().min(1, "Content cannot be empty"),
  status: microblogStatusSchema.default("draft"),
  createdAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  tags: z.union([z.array(z.string()), z.string()]).transform((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      return val
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  }),
  coverImageUrl: z.string().nullable().optional(),
  shortUrl: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  tripId: z.string().nullable().optional(),
  images: z.union([z.array(z.string()), z.string()]).transform((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fallback for comma separated strings
      }
      return val
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
    }
    return [];
  }).default([]),
});

export type MicroblogFormInput = z.input<typeof microblogInputSchema>;

export function generateSlug(content: string): string {
  const clean = content
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);

  const timestamp = Date.now().toString().slice(-6);
  return clean ? `${clean}-${timestamp}` : `post-${timestamp}`;
}
