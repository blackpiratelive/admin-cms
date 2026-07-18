import { z } from "zod";

export const DEFAULT_RELATIONSHIP_TYPES = [
  "Family",
  "Friend",
  "Partner",
  "Relative",
  "Colleague",
  "Classmate",
  "Neighbor",
  "Mentor",
] as const;

export const DEFAULT_IMPORTANT_DATE_TYPES = [
  "Birthday",
  "Anniversary",
  "Met On",
  "Wedding",
  "Graduation",
  "Custom",
] as const;

export interface ImportantDate {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD or string date
  reminderEnabled: boolean;
  notes?: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  github?: string;
  linkedin?: string;
  website?: string;
  [key: string]: string | undefined;
}

export const importantDateSchema = z.object({
  id: z.string().default(() => `date_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
  title: z.string().min(1, "Title is required"),
  date: z.string().min(1, "Date is required"),
  reminderEnabled: z.boolean().default(false),
  notes: z.string().optional().default(""),
});

export const personInputSchema = z.object({
  displayName: z.string().min(1, "Display name is required").trim(),
  firstName: z.string().optional().default("").transform((v) => v?.trim() || ""),
  lastName: z.string().optional().default("").transform((v) => v?.trim() || ""),
  nickname: z.string().optional().default("").transform((v) => v?.trim() || ""),
  slug: z.string().optional().default(""),
  avatarUrl: z.string().optional().default(""),
  relationshipType: z.string().optional().default("Friend"),
  importantDates: z.array(importantDateSchema).optional().default([]),
  notesMarkdown: z.string().optional().default(""),
  interests: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([])
    .transform((val) => {
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      if (typeof val === "string") {
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    }),
  socialLinks: z
    .object({
      instagram: z.string().optional().default(""),
      facebook: z.string().optional().default(""),
      github: z.string().optional().default(""),
      linkedin: z.string().optional().default(""),
      website: z.string().optional().default(""),
    })
    .optional()
    .default({}),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  favorite: z.boolean().or(z.number()).transform((val) => (val ? 1 : 0)).default(0),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .default([])
    .transform((val) => {
      if (Array.isArray(val)) return val.map((s) => s.trim()).filter(Boolean);
      if (typeof val === "string") {
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    }),
});

export type PersonInput = z.infer<typeof personInputSchema>;

export function generatePersonSlug(displayName: string, fallbackId?: string): string {
  const clean = displayName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (clean.length > 0) return clean;
  return `person-${fallbackId || Date.now()}`;
}
