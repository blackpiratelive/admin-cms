import { z } from "zod";

export const galleryPhotoInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional().nullable(),
  originalUrl: z.string().min(1, "Original URL is required"),
  largeUrl: z.string().min(1, "Large URL is required"),
  mediumUrl: z.string().min(1, "Medium URL is required"),
  thumbnailUrl: z.string().min(1, "Thumbnail URL is required"),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  camera: z.string().optional().nullable(),
  lens: z.string().optional().nullable(),
  focalLength: z.string().optional().nullable(),
  aperture: z.string().optional().nullable(),
  shutterSpeed: z.string().optional().nullable(),
  iso: z.number().optional().nullable(),
  takenAt: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationName: z.string().optional().nullable(),
  visibility: z.enum(["public", "private", "unlisted"]).default("public"),
  featured: z.boolean().default(false),
  processingStatus: z.enum(["pending", "processing", "ready", "failed"]).default("ready"),
  tags: z.union([z.array(z.string()), z.string()]).transform((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }),
  album: z.string().optional().nullable(),
});

export type GalleryPhotoInput = z.infer<typeof galleryPhotoInputSchema>;

export function generatePhotoSlug(titleOrFilename: string): string {
  const base = titleOrFilename
    .toLowerCase()
    .replace(/\.[^/.]+$/, "") // strip file extension
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric chars with hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens

  return base || `photo-${Date.now().toString(36)}`;
}
