"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  trips,
  TripRecord,
  NewTrip,
  locations,
  LocationRecord,
  microblogs,
  Microblog,
  gallery,
  GalleryPhoto,
  movieMetadata,
  traktMovies,
  relationships,
  persons,
  PersonRecord,
} from "@/db/schema";
import { desc, eq, or, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship, removeRelationship } from "@/features/relationships/actions";

export async function getTrips(): Promise<TripRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(trips)
    .orderBy(desc(trips.createdAt));
}

export async function getTripByIdOrSlug(idOrSlug: string): Promise<TripRecord | null> {
  await ensureDbInitialized();

  const byId = await db.select().from(trips).where(eq(trips.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(trips).where(eq(trips.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
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

  try {
    revalidatePath("/trips");
  } catch {}
  return newTrip as TripRecord;
}

export async function updateTrip(
  id: string,
  data: Partial<TripRecord> & { tags?: string[] | string }
): Promise<TripRecord | null> {
  await ensureDbInitialized();

  const existing = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!existing[0]) return null;

  const now = new Date().toISOString();
  const updates: Partial<TripRecord> = {
    updatedAt: now,
  };

  if (data.title !== undefined) updates.title = data.title;
  if (data.slug !== undefined && data.slug.trim()) updates.slug = data.slug.trim();
  if (data.description !== undefined) updates.description = data.description || null;
  if (data.startDate !== undefined) updates.startDate = data.startDate || null;
  if (data.endDate !== undefined) updates.endDate = data.endDate || null;
  if (data.status !== undefined) updates.status = data.status;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.favorite !== undefined) updates.favorite = data.favorite ? 1 : 0;

  if (data.tags !== undefined) {
    if (Array.isArray(data.tags)) {
      updates.tags = JSON.stringify(data.tags);
    } else if (typeof data.tags === "string") {
      updates.tags = JSON.stringify(
        data.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }
  }

  await db.update(trips).set(updates).where(eq(trips.id, id));
  await logActivity("trip_updated", "trip", id, `Updated Trip: ${updates.title || existing[0].title}`, {
    id,
  });

  try {
    revalidatePath("/trips");
    revalidatePath(`/trips/${updates.slug || existing[0].slug}`);
  } catch {}

  const updatedRecord = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return updatedRecord[0] || null;
}

export async function deleteTrip(id: string): Promise<boolean> {
  await ensureDbInitialized();
  await db.delete(trips).where(eq(trips.id, id));
  
  // Clean relationships
  await db
    .delete(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, id)),
        and(eq(relationships.targetType, "trip"), eq(relationships.targetId, id))
      )
    );

  try {
    revalidatePath("/trips");
  } catch {}
  return true;
}

export interface TripAssociatedEntities {
  associatedLocations: Array<{ relationshipId?: string; location: LocationRecord }>;
  microblogs: Microblog[];
  photos: GalleryPhoto[];
  movies: any[];
  people: Array<{ relationshipId?: string; person: PersonRecord }>;
}

export async function getTripAssociatedEntities(tripId: string): Promise<TripAssociatedEntities> {
  await ensureDbInitialized();

  // 1. Associated Microblogs
  const directMicroblogs = await db.select().from(microblogs).where(eq(microblogs.tripId, tripId));

  // 2. Associated Gallery Photos
  const directPhotos = await db.select().from(gallery).where(eq(gallery.tripId, tripId));

  // 3. Movies with tripId
  const directMovieMeta = await db.select().from(movieMetadata).where(eq(movieMetadata.tripId, tripId));
  const moviesList: any[] = [];
  for (const mm of directMovieMeta) {
    const mov = await db.select().from(traktMovies).where(eq(traktMovies.traktId, mm.traktId)).limit(1);
    if (mov[0]) moviesList.push({ ...mov[0], personalMetadata: mm });
  }

  // 4. Relationships (Locations & People)
  const relRows = await db
    .select()
    .from(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "location")),
        and(eq(relationships.sourceType, "location"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId)),
        and(eq(relationships.sourceType, "person"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId)),
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "person"))
      )
    );

  const associatedLocations: Array<{ relationshipId?: string; location: LocationRecord }> = [];
  const associatedPeople: Array<{ relationshipId?: string; person: PersonRecord }> = [];

  for (const rel of relRows) {
    const isSourceTrip = rel.sourceType === "trip" && rel.sourceId === tripId;
    const otherType = isSourceTrip ? rel.targetType : rel.sourceType;
    const otherId = isSourceTrip ? rel.targetId : rel.sourceId;

    if (otherType === "location") {
      const loc = await db.select().from(locations).where(eq(locations.id, otherId)).limit(1);
      if (loc[0] && !associatedLocations.some((l) => l.location.id === loc[0].id)) {
        associatedLocations.push({ relationshipId: rel.id, location: loc[0] });
      }
    } else if (otherType === "person") {
      const p = await db.select().from(persons).where(eq(persons.id, otherId)).limit(1);
      if (p[0] && !associatedPeople.some((pe) => pe.person.id === p[0].id)) {
        associatedPeople.push({ relationshipId: rel.id, person: p[0] });
      }
    }
  }

  return {
    associatedLocations,
    microblogs: directMicroblogs,
    photos: directPhotos,
    movies: moviesList,
    people: associatedPeople,
  };
}

export async function connectTripToLocation(
  tripId: string,
  locationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("trip", tripId, "location", locationId, "includes_location");
    const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
    const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    if (tr[0]) {
      try {
        revalidatePath(`/trips/${tr[0].slug}`);
      } catch {}
    }
    if (loc[0]) {
      try {
        revalidatePath(`/locations/${loc[0].slug}`);
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to associate location with trip" };
  }
}
