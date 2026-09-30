import { z } from "zod";

export const microblogStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

export const microblogInputSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  // Drafts may be saved empty; published/scheduled posts must have text or an image
  // (enforced by the superRefine below).
  contentMarkdown: z.string().default(""),
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
  postToBluesky: z.boolean().optional().default(true),
  postToMastodon: z.boolean().optional().default(true),
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
}).superRefine((data, ctx) => {
  // A live post (published or scheduled) needs something to show: text or an image.
  const needsContent = data.status === "published" || data.status === "scheduled";
  if (needsContent) {
    const hasText = data.contentMarkdown.trim().length > 0;
    const hasImages = Array.isArray(data.images) && data.images.length > 0;
    if (!hasText && !hasImages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentMarkdown"],
        message: "A published post needs text or at least one image",
      });
    }
  }
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
