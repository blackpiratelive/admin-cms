"use server";

import { db, ensureDbInitialized } from "@/db";
import { locations, LocationRecord, NewLocation } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";

export async function getLocations(): Promise<LocationRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(locations)
    .orderBy(desc(locations.createdAt));
}

export async function createLocation(data: {
  name: string;
  slug?: string;
  country?: string;
  state?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  privateNotes?: string;
  publicDescription?: string;
  tags?: string[];
  visibility?: "public" | "private" | "unlisted";
  favorite?: number;
  photographyNotes?: string;
  cameraRecommendations?: string;
  personalRating?: number;
}): Promise<LocationRecord> {
  await ensureDbInitialized();

  const id = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const now = new Date().toISOString();

  const newLoc: NewLocation = {
    id,
    name: data.name,
    slug,
    country: data.country || null,
    state: data.state || null,
    city: data.city || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    elevation: data.elevation || null,
    timezone: data.timezone || null,
    firstVisited: now,
    lastVisited: now,
    visitCount: 1,
    privateNotes: data.privateNotes || null,
    publicDescription: data.publicDescription || null,
    tags: JSON.stringify(data.tags || []),
    visibility: data.visibility || "public",
    favorite: data.favorite ? 1 : 0,
    photographyNotes: data.photographyNotes || null,
    cameraRecommendations: data.cameraRecommendations || null,
    personalRating: data.personalRating || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(locations).values(newLoc);
  await logActivity("location_created", "location", id, `Created Location: ${data.name}`, { slug });

  revalidatePath("/locations");
  return newLoc as LocationRecord;
}

export async function deleteLocation(id: string): Promise<boolean> {
  await ensureDbInitialized();
  await db.delete(locations).where(eq(locations.id, id));
  revalidatePath("/locations");
  return true;
}
