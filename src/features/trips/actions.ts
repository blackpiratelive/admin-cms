"use server";

import { db, ensureDbInitialized } from "@/db";
import { trips, TripRecord, NewTrip } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";

export async function getTrips(): Promise<TripRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(trips)
    .orderBy(desc(trips.createdAt));
}

export async function createTrip(data: {
  title: string;
  slug?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: "planned" | "ongoing" | "completed" | "cancelled";
  visibility?: "public" | "private" | "unlisted";
  favorite?: number;
  tags?: string[];
}): Promise<TripRecord> {
  await ensureDbInitialized();

  const id = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const now = new Date().toISOString();

  const newTrip: NewTrip = {
    id,
    title: data.title,
    slug,
    description: data.description || null,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    status: data.status || "planned",
    visibility: data.visibility || "public",
    favorite: data.favorite ? 1 : 0,
    tags: JSON.stringify(data.tags || []),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(trips).values(newTrip);
  await logActivity("trip_created", "trip", id, `Created Trip: ${data.title}`, { slug });

  revalidatePath("/trips");
  return newTrip as TripRecord;
}

export async function deleteTrip(id: string): Promise<boolean> {
  await ensureDbInitialized();
  await db.delete(trips).where(eq(trips.id, id));
  revalidatePath("/trips");
  return true;
}
