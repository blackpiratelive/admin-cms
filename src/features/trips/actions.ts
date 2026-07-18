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
import { desc, eq, or, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship, removeRelationship } from "@/features/relationships/actions";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import { eventBus } from "@/lib/event-bus";

async function fetchTripsRaw(): Promise<TripRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(trips)
    .orderBy(desc(trips.createdAt));
}

export async function getTrips(): Promise<TripRecord[]> {
  const cachedFn = createCachedQuery(
    fetchTripsRaw,
    ["trips-list"],
    { tags: ["trips-list"], revalidate: 3600 }
  );

  return cachedFn();
}

async function fetchTripByIdOrSlugRaw(idOrSlug: string): Promise<TripRecord | null> {
  await ensureDbInitialized();

  const byId = await db.select().from(trips).where(eq(trips.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(trips).where(eq(trips.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
}

export async function getTripByIdOrSlug(idOrSlug: string): Promise<TripRecord | null> {
  const cachedFn = createCachedQuery(
    () => fetchTripByIdOrSlugRaw(idOrSlug),
    ["trip-detail", idOrSlug],
    { tags: ["trips-list", `trip-${idOrSlug}`], revalidate: 3600 }
  );

  return cachedFn();
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

  purgeTag("trips-list");

  try {
    revalidatePath("/trips");
  } catch {}

  eventBus.emit("entity.saved", {
    type: "trip",
    id,
    title: data.title,
    subtitle: data.description || "Trip",
    keywords: `${data.title} ${data.description || ""} ${(data.tags || []).join(" ")}`,
    url: `/trips`,
  });

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

  purgeTag("trips-list");
  purgeTag(`trip-${id}`);
  purgeTag(`trip-${existing[0].slug}`);
  if (updates.slug) purgeTag(`trip-${updates.slug}`);

  try {
    revalidatePath("/trips");
    revalidatePath(`/trips/${updates.slug || existing[0].slug}`);
  } catch {}

  const updatedRecord = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (updatedRecord[0]) {
    eventBus.emit("entity.saved", {
      type: "trip",
      id,
      title: updatedRecord[0].title,
      subtitle: updatedRecord[0].description || "Trip",
      keywords: `${updatedRecord[0].title} ${updatedRecord[0].description || ""} ${updatedRecord[0].tags}`,
      url: `/trips`,
    });
  }
  return updatedRecord[0] || null;
}

export async function deleteTrip(id: string): Promise<boolean> {
  await ensureDbInitialized();
  const existing = await db.select().from(trips).where(eq(trips.id, id)).limit(1);

  await db.delete(trips).where(eq(trips.id, id));
  await db
    .delete(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, id)),
        and(eq(relationships.targetType, "trip"), eq(relationships.targetId, id))
      )
    );

  purgeTag("trips-list");
  if (existing[0]) purgeTag(`trip-${existing[0].slug}`);

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

export interface TripHubData {
  trip: TripRecord | null;
  entities: TripAssociatedEntities;
}

async function fetchTripHubDataRaw(slug: string): Promise<TripHubData | null> {
  await ensureDbInitialized();

  const trip = await fetchTripByIdOrSlugRaw(slug);
  if (!trip) return null;

  const tripId = trip.id;

  // Execute direct lookups & relationship queries in 1 parallel batch!
  const [directMicroblogs, directPhotos, directMovieMeta, relRows] = await Promise.all([
    db.select().from(microblogs).where(eq(microblogs.tripId, tripId)),
    db.select().from(gallery).where(eq(gallery.tripId, tripId)),
    db.select().from(movieMetadata).where(eq(movieMetadata.tripId, tripId)),
    db.select().from(relationships).where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "location")),
        and(eq(relationships.sourceType, "location"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId)),
        and(eq(relationships.sourceType, "person"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId)),
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "person"))
      )
    ),
  ]);

  const movieTraktIds = directMovieMeta.map((m) => m.traktId);
  const moviesList = movieTraktIds.length > 0 ? await db.select().from(traktMovies).where(inArray(traktMovies.traktId, movieTraktIds)) : [];
  const metaMap = new Map(directMovieMeta.map((mm) => [mm.traktId, mm]));
  const moviesWithMeta = moviesList.map((m) => ({ ...m, personalMetadata: metaMap.get(m.traktId) }));

  const locRelMap = new Map<string, string>();
  const personRelMap = new Map<string, string>();
  const locIds: string[] = [];
  const personIds: string[] = [];

  for (const rel of relRows) {
    const isSourceTrip = rel.sourceType === "trip" && rel.sourceId === tripId;
    const otherType = isSourceTrip ? rel.targetType : rel.sourceType;
    const otherId = isSourceTrip ? rel.targetId : rel.sourceId;

    if (otherType === "location") {
      locIds.push(otherId);
      locRelMap.set(otherId, rel.id);
    } else if (otherType === "person") {
      personIds.push(otherId);
      personRelMap.set(otherId, rel.id);
    }
  }

  const [locsRes, peopleRes] = await Promise.all([
    locIds.length > 0 ? db.select().from(locations).where(inArray(locations.id, locIds)) : Promise.resolve([]),
    personIds.length > 0 ? db.select().from(persons).where(inArray(persons.id, personIds)) : Promise.resolve([]),
  ]);

  const associatedLocations = locsRes.map((l) => ({ relationshipId: locRelMap.get(l.id), location: l }));
  const associatedPeople = peopleRes.map((p) => ({ relationshipId: personRelMap.get(p.id), person: p }));

  return {
    trip,
    entities: {
      associatedLocations,
      microblogs: directMicroblogs,
      photos: directPhotos,
      movies: moviesWithMeta,
      people: associatedPeople,
    },
  };
}

export async function getTripHubDataAction(slug: string): Promise<TripHubData | null> {
  const cachedFn = createCachedQuery(
    () => fetchTripHubDataRaw(slug),
    ["trip-hub-data", slug],
    { tags: ["trips-list", `trip-${slug}`], revalidate: 3600 }
  );

  return cachedFn();
}

export async function getTripAssociatedEntities(tripId: string): Promise<TripAssociatedEntities> {
  const tr = await fetchTripByIdOrSlugRaw(tripId);
  if (!tr) return { associatedLocations: [], microblogs: [], photos: [], movies: [], people: [] };

  const hubData = await getTripHubDataAction(tr.slug);
  return hubData?.entities || { associatedLocations: [], microblogs: [], photos: [], movies: [], people: [] };
}

export async function connectTripToLocation(
  tripId: string,
  locationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("trip", tripId, "location", locationId, "includes_location");
    
    purgeTag("trips-list");
    purgeTag("locations-list");

    const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
    const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    if (tr[0]) {
      purgeTag(`trip-${tr[0].slug}`);
      try {
        revalidatePath(`/trips/${tr[0].slug}`);
      } catch {}
    }
    if (loc[0]) {
      purgeTag(`location-${loc[0].slug}`);
      try {
        revalidatePath(`/locations/${loc[0].slug}`);
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to associate location with trip" };
  }
}
