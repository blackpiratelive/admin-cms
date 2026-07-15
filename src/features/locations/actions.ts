"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  locations,
  LocationRecord,
  NewLocation,
  trips,
  TripRecord,
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

export async function getLocations(): Promise<LocationRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(locations)
    .orderBy(desc(locations.createdAt));
}

export async function getLocationByIdOrSlug(idOrSlug: string): Promise<LocationRecord | null> {
  await ensureDbInitialized();

  const byId = await db.select().from(locations).where(eq(locations.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(locations).where(eq(locations.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
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

  try {
    revalidatePath("/locations");
  } catch {}
  return newLoc as LocationRecord;
}

export async function updateLocation(
  id: string,
  data: Partial<LocationRecord> & { tags?: string[] | string }
): Promise<LocationRecord | null> {
  await ensureDbInitialized();

  const existing = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  if (!existing[0]) return null;

  const now = new Date().toISOString();
  const updates: Partial<LocationRecord> = {
    updatedAt: now,
  };

  if (data.name !== undefined) updates.name = data.name;
  if (data.slug !== undefined && data.slug.trim()) updates.slug = data.slug.trim();
  if (data.country !== undefined) updates.country = data.country || null;
  if (data.state !== undefined) updates.state = data.state || null;
  if (data.city !== undefined) updates.city = data.city || null;
  if (data.latitude !== undefined) updates.latitude = data.latitude;
  if (data.longitude !== undefined) updates.longitude = data.longitude;
  if (data.elevation !== undefined) updates.elevation = data.elevation;
  if (data.timezone !== undefined) updates.timezone = data.timezone || null;
  if (data.privateNotes !== undefined) updates.privateNotes = data.privateNotes || null;
  if (data.publicDescription !== undefined) updates.publicDescription = data.publicDescription || null;
  if (data.photographyNotes !== undefined) updates.photographyNotes = data.photographyNotes || null;
  if (data.cameraRecommendations !== undefined) updates.cameraRecommendations = data.cameraRecommendations || null;
  if (data.personalRating !== undefined) updates.personalRating = data.personalRating;
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

  await db.update(locations).set(updates).where(eq(locations.id, id));
  await logActivity("location_updated", "location", id, `Updated Location: ${updates.name || existing[0].name}`, {
    id,
  });

  try {
    revalidatePath("/locations");
    revalidatePath(`/locations/${updates.slug || existing[0].slug}`);
  } catch {}

  const updatedRecord = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return updatedRecord[0] || null;
}

export async function deleteLocation(id: string): Promise<boolean> {
  await ensureDbInitialized();
  await db.delete(locations).where(eq(locations.id, id));
  
  // Clean relationships referencing this location
  await db
    .delete(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, id)),
        and(eq(relationships.targetType, "location"), eq(relationships.targetId, id))
      )
    );

  try {
    revalidatePath("/locations");
  } catch {}
  return true;
}

export interface LocationAssociatedEntities {
  associatedTrips: Array<{ relationshipId?: string; trip: TripRecord }>;
  microblogs: Microblog[];
  photos: GalleryPhoto[];
  movies: any[];
  people: Array<{ relationshipId?: string; person: PersonRecord }>;
}

export async function getLocationAssociatedEntities(locationId: string): Promise<LocationAssociatedEntities> {
  await ensureDbInitialized();

  // 1. Associated Microblogs (direct locationId or via relationships)
  const directMicroblogs = await db.select().from(microblogs).where(eq(microblogs.locationId, locationId));

  // 2. Associated Gallery Photos
  const directPhotos = await db.select().from(gallery).where(eq(gallery.locationId, locationId));

  // 3. Movies with watchLocation / locationId
  const directMovieMeta = await db.select().from(movieMetadata).where(eq(movieMetadata.locationId, locationId));
  const moviesList: any[] = [];
  for (const mm of directMovieMeta) {
    const mov = await db.select().from(traktMovies).where(eq(traktMovies.traktId, mm.traktId)).limit(1);
    if (mov[0]) moviesList.push({ ...mov[0], personalMetadata: mm });
  }

  // 4. Relationships (Trips & People)
  const relRows = await db
    .select()
    .from(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.targetType, "location"), eq(relationships.targetId, locationId)),
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, locationId), eq(relationships.targetType, "trip")),
        and(eq(relationships.sourceType, "person"), eq(relationships.targetType, "location"), eq(relationships.targetId, locationId)),
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, locationId), eq(relationships.targetType, "person"))
      )
    );

  const associatedTrips: Array<{ relationshipId?: string; trip: TripRecord }> = [];
  const associatedPeople: Array<{ relationshipId?: string; person: PersonRecord }> = [];

  for (const rel of relRows) {
    const isSourceLoc = rel.sourceType === "location" && rel.sourceId === locationId;
    const otherType = isSourceLoc ? rel.targetType : rel.sourceType;
    const otherId = isSourceLoc ? rel.targetId : rel.sourceId;

    if (otherType === "trip") {
      const tr = await db.select().from(trips).where(eq(trips.id, otherId)).limit(1);
      if (tr[0] && !associatedTrips.some((t) => t.trip.id === tr[0].id)) {
        associatedTrips.push({ relationshipId: rel.id, trip: tr[0] });
      }
    } else if (otherType === "person") {
      const p = await db.select().from(persons).where(eq(persons.id, otherId)).limit(1);
      if (p[0] && !associatedPeople.some((pe) => pe.person.id === p[0].id)) {
        associatedPeople.push({ relationshipId: rel.id, person: p[0] });
      }
    }
  }

  return {
    associatedTrips,
    microblogs: directMicroblogs,
    photos: directPhotos,
    movies: moviesList,
    people: associatedPeople,
  };
}

export async function connectLocationToTrip(
  locationId: string,
  tripId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("trip", tripId, "location", locationId, "includes_location");
    const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
    if (loc[0]) {
      try {
        revalidatePath(`/locations/${loc[0].slug}`);
      } catch {}
    }
    if (tr[0]) {
      try {
        revalidatePath(`/trips/${tr[0].slug}`);
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to associate trip with location" };
  }
}

export async function removeLocationTripConnection(
  relationshipId: string,
  locationSlug?: string,
  tripSlug?: string
): Promise<{ success: boolean }> {
  await ensureDbInitialized();
  await removeRelationship(relationshipId);
  if (locationSlug) {
    try {
      revalidatePath(`/locations/${locationSlug}`);
    } catch {}
  }
  if (tripSlug) {
    try {
      revalidatePath(`/trips/${tripSlug}`);
    } catch {}
  }
  return { success: true };
}
