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
  attachments,
  tripDays,
} from "@/db/schema";
import { desc, eq, or, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship, removeRelationship } from "@/features/relationships/actions";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import { eventBus } from "@/lib/event-bus";
import type { LocationPickerOption } from "@/features/pickers/types";
import type { BatchPhotoConnectItem } from "@/components/PhotoPickerModal";

async function fetchLocationsRaw(): Promise<LocationRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(locations)
    .orderBy(desc(locations.createdAt));
}

export async function getLocations(): Promise<LocationRecord[]> {
  const cachedFn = createCachedQuery(
    fetchLocationsRaw,
    ["locations-list"],
    { tags: ["locations-list"], revalidate: 3600 }
  );

  return cachedFn();
}

async function fetchLocationByIdOrSlugRaw(idOrSlug: string): Promise<LocationRecord | null> {
  await ensureDbInitialized();

  const byId = await db.select().from(locations).where(eq(locations.id, idOrSlug)).limit(1);
  if (byId[0]) return byId[0];

  const bySlug = await db.select().from(locations).where(eq(locations.slug, idOrSlug)).limit(1);
  if (bySlug[0]) return bySlug[0];

  return null;
}

export async function getLocationByIdOrSlug(idOrSlug: string): Promise<LocationRecord | null> {
  const cachedFn = createCachedQuery(
    () => fetchLocationByIdOrSlugRaw(idOrSlug),
    ["location-detail", idOrSlug],
    { tags: ["locations-list", `location-${idOrSlug}`], revalidate: 3600 }
  );

  return cachedFn();
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

  purgeTag("locations-list");

  try {
    revalidatePath("/locations");
  } catch {}

  eventBus.emit("entity.saved", {
    type: "location",
    id,
    title: data.name,
    subtitle: [data.city, data.state, data.country].filter(Boolean).join(", "),
    keywords: `${data.name} ${data.city || ""} ${data.state || ""} ${data.country || ""}`,
    url: `/locations`,
  });

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

  purgeTag("locations-list");
  purgeTag(`location-${id}`);
  purgeTag(`location-${existing[0].slug}`);
  if (updates.slug) purgeTag(`location-${updates.slug}`);

  const updatedLoc = { ...existing[0], ...updates };
  eventBus.emit("entity.saved", {
    type: "location",
    id,
    title: updatedLoc.name,
    subtitle: [updatedLoc.city, updatedLoc.state, updatedLoc.country].filter(Boolean).join(", "),
    keywords: `${updatedLoc.name} ${updatedLoc.city || ""} ${updatedLoc.state || ""} ${updatedLoc.country || ""}`,
    url: `/locations`,
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
  const existing = await db.select().from(locations).where(eq(locations.id, id)).limit(1);

  await db.delete(locations).where(eq(locations.id, id));
  await db
    .delete(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, id)),
        and(eq(relationships.targetType, "location"), eq(relationships.targetId, id))
      )
    );

  purgeTag("locations-list");
  if (existing[0]) purgeTag(`location-${existing[0].slug}`);

  try {
    revalidatePath("/locations");
  } catch {}
  return true;
}

export interface LocationPhotoItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  mediumUrl: string;
  originalUrl?: string;
  largeUrl?: string;
  width?: number | null;
  height?: number | null;
  sourceType: "direct" | "trip" | "attachment";
  sourceTrip?: {
    id: string;
    title: string;
    slug: string;
  };
  relationshipId?: string;
  createdAt?: string;
}

export interface LocationAssociatedEntities {
  associatedTrips: Array<{ relationshipId?: string; trip: TripRecord }>;
  microblogs: Microblog[];
  photos: LocationPhotoItem[];
  movies: any[];
  people: Array<{ relationshipId?: string; person: PersonRecord }>;
}

export interface LocationHubData {
  location: LocationRecord | null;
  entities: LocationAssociatedEntities;
}

async function fetchLocationHubDataRaw(slug: string): Promise<LocationHubData | null> {
  await ensureDbInitialized();

  const location = await fetchLocationByIdOrSlugRaw(slug);
  if (!location) return null;

  const locationId = location.id;

  // Execute queries in parallel batch in 1 round-trip!
  const [directMicroblogs, directPhotos, directMovieMeta, directAttachments, relRows] = await Promise.all([
    db.select().from(microblogs).where(eq(microblogs.locationId, locationId)),
    db.select().from(gallery).where(eq(gallery.locationId, locationId)),
    db.select().from(movieMetadata).where(eq(movieMetadata.locationId, locationId)),
    db.select().from(attachments).where(
      and(
        eq(attachments.entityType, "location"),
        eq(attachments.entityId, locationId),
        eq(attachments.kind, "photo")
      )
    ),
    db.select().from(relationships).where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.targetType, "location"), eq(relationships.targetId, locationId)),
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, locationId), eq(relationships.targetType, "trip")),
        and(eq(relationships.sourceType, "person"), eq(relationships.targetType, "location"), eq(relationships.targetId, locationId)),
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, locationId), eq(relationships.targetType, "person")),
        and(eq(relationships.sourceType, "gallery"), eq(relationships.targetType, "location"), eq(relationships.targetId, locationId)),
        and(eq(relationships.sourceType, "location"), eq(relationships.sourceId, locationId), eq(relationships.targetType, "gallery"))
      )
    ),
  ]);

  // Fetch movies in batch
  const movieTraktIds = directMovieMeta.map((m) => m.traktId);
  const moviesList = movieTraktIds.length > 0 ? await db.select().from(traktMovies).where(inArray(traktMovies.traktId, movieTraktIds)) : [];
  const metaMap = new Map(directMovieMeta.map((mm) => [mm.traktId, mm]));
  const moviesWithMeta = moviesList.map((m) => ({ ...m, personalMetadata: metaMap.get(m.traktId) }));

  // Collect trip, person & gallery IDs from relationships
  const tripRelMap = new Map<string, string>();
  const personRelMap = new Map<string, string>();
  const galleryRelMap = new Map<string, string>();
  const tripIds: string[] = [];
  const personIds: string[] = [];
  const galleryRelIds: string[] = [];

  for (const rel of relRows) {
    const isSourceLoc = rel.sourceType === "location" && rel.sourceId === locationId;
    const otherType = isSourceLoc ? rel.targetType : rel.sourceType;
    const otherId = isSourceLoc ? rel.targetId : rel.sourceId;

    if (otherType === "trip") {
      tripIds.push(otherId);
      tripRelMap.set(otherId, rel.id);
    } else if (otherType === "person") {
      personIds.push(otherId);
      personRelMap.set(otherId, rel.id);
    } else if (otherType === "gallery") {
      galleryRelIds.push(otherId);
      galleryRelMap.set(otherId, rel.id);
    }
  }

  const [tripsRes, peopleRes, relGalleryRes] = await Promise.all([
    tripIds.length > 0 ? db.select().from(trips).where(inArray(trips.id, tripIds)) : Promise.resolve([]),
    personIds.length > 0 ? db.select().from(persons).where(inArray(persons.id, personIds)) : Promise.resolve([]),
    galleryRelIds.length > 0 ? db.select().from(gallery).where(inArray(gallery.id, galleryRelIds)) : Promise.resolve([]),
  ]);

  const tripMap = new Map(tripsRes.map((t) => [t.id, t]));
  const associatedTrips = tripsRes.map((t) => ({ relationshipId: tripRelMap.get(t.id), trip: t }));
  const associatedPeople = peopleRes.map((p) => ({ relationshipId: personRelMap.get(p.id), person: p }));

  // Roll up photos from associated trips (gallery, attachments, and trip_days)
  const [tripGalleryRes, tripAttachmentsRes, tripDaysRes] = await Promise.all([
    tripIds.length > 0 ? db.select().from(gallery).where(inArray(gallery.tripId, tripIds)) : Promise.resolve([]),
    tripIds.length > 0
      ? db
          .select()
          .from(attachments)
          .where(
            and(
              eq(attachments.entityType, "trip"),
              inArray(attachments.entityId, tripIds),
              eq(attachments.kind, "photo")
            )
          )
      : Promise.resolve([]),
    tripIds.length > 0 ? db.select().from(tripDays).where(inArray(tripDays.tripId, tripIds)) : Promise.resolve([]),
  ]);

  // Unified photo map (deduplicated by key)
  const photoMap = new Map<string, LocationPhotoItem>();

  // 1. Direct gallery photos for this location
  for (const p of directPhotos) {
    const trip = p.tripId ? tripMap.get(p.tripId) : undefined;
    photoMap.set(`gallery_${p.id}`, {
      id: p.id,
      title: p.title,
      thumbnailUrl: p.thumbnailUrl || p.mediumUrl || p.originalUrl,
      mediumUrl: p.mediumUrl || p.originalUrl,
      largeUrl: p.largeUrl,
      originalUrl: p.originalUrl,
      width: p.width,
      height: p.height,
      sourceType: trip ? "trip" : "direct",
      sourceTrip: trip ? { id: trip.id, title: trip.title, slug: trip.slug } : undefined,
      createdAt: p.createdAt,
    });
  }

  // 2. Photos linked to this location via relationships
  for (const p of relGalleryRes) {
    const key = `gallery_${p.id}`;
    if (!photoMap.has(key)) {
      const trip = p.tripId ? tripMap.get(p.tripId) : undefined;
      photoMap.set(key, {
        id: p.id,
        title: p.title,
        thumbnailUrl: p.thumbnailUrl || p.mediumUrl || p.originalUrl,
        mediumUrl: p.mediumUrl || p.originalUrl,
        largeUrl: p.largeUrl,
        originalUrl: p.originalUrl,
        width: p.width,
        height: p.height,
        sourceType: trip ? "trip" : "direct",
        sourceTrip: trip ? { id: trip.id, title: trip.title, slug: trip.slug } : undefined,
        relationshipId: galleryRelMap.get(p.id),
        createdAt: p.createdAt,
      });
    }
  }

  // 3. Direct uploaded/Cloudinary attachments for this location
  for (const att of directAttachments) {
    let meta: any = {};
    try {
      meta = JSON.parse(att.metadataJson || "{}");
    } catch {}
    photoMap.set(`att_${att.id}`, {
      id: att.id,
      title: meta.title || "Photo",
      thumbnailUrl: att.url,
      mediumUrl: att.url,
      largeUrl: att.url,
      originalUrl: att.url,
      width: att.width,
      height: att.height,
      sourceType: "attachment",
      relationshipId: att.id,
      createdAt: att.createdAt,
    });
  }

  // 4. Photos associated with linked trips (Gallery)
  for (const p of tripGalleryRes) {
    const key = `gallery_${p.id}`;
    const trip = p.tripId ? tripMap.get(p.tripId) : undefined;
    if (!photoMap.has(key)) {
      photoMap.set(key, {
        id: p.id,
        title: p.title,
        thumbnailUrl: p.thumbnailUrl || p.mediumUrl || p.originalUrl,
        mediumUrl: p.mediumUrl || p.originalUrl,
        largeUrl: p.largeUrl,
        originalUrl: p.originalUrl,
        width: p.width,
        height: p.height,
        sourceType: "trip",
        sourceTrip: trip ? { id: trip.id, title: trip.title, slug: trip.slug } : undefined,
        createdAt: p.createdAt,
      });
    } else if (trip) {
      const existing = photoMap.get(key)!;
      existing.sourceTrip = { id: trip.id, title: trip.title, slug: trip.slug };
    }
  }

  // 5. Photos associated with linked trips (Attachments)
  for (const att of tripAttachmentsRes) {
    const trip = tripMap.get(att.entityId);
    let meta: any = {};
    try {
      meta = JSON.parse(att.metadataJson || "{}");
    } catch {}
    photoMap.set(`trip_att_${att.id}`, {
      id: att.id,
      title: meta.title || (trip ? `Photo from ${trip.title}` : "Trip Photo"),
      thumbnailUrl: att.url,
      mediumUrl: att.url,
      largeUrl: att.url,
      originalUrl: att.url,
      width: att.width,
      height: att.height,
      sourceType: "trip",
      sourceTrip: trip ? { id: trip.id, title: trip.title, slug: trip.slug } : undefined,
      createdAt: att.createdAt,
    });
  }

  // 6. Photos from trip days of linked trips (photosJson)
  for (const day of tripDaysRes) {
    const trip = tripMap.get(day.tripId);
    let parsedPhotos: Array<{ id?: string; url: string; caption?: string }> = [];
    try {
      const raw = JSON.parse(day.photosJson || "[]");
      if (Array.isArray(raw)) parsedPhotos = raw;
    } catch {}

    parsedPhotos.forEach((p, idx) => {
      if (p.url) {
        const dayPhotoKey = `trip_day_${day.id}_${p.id || idx}`;
        if (!photoMap.has(dayPhotoKey)) {
          photoMap.set(dayPhotoKey, {
            id: dayPhotoKey,
            title:
              p.caption ||
              (day.title ? `${day.title} (Day ${day.dayNumber})` : `Day ${day.dayNumber} Photo`),
            thumbnailUrl: p.url,
            mediumUrl: p.url,
            largeUrl: p.url,
            originalUrl: p.url,
            sourceType: "trip",
            sourceTrip: trip ? { id: trip.id, title: trip.title, slug: trip.slug } : undefined,
            createdAt: day.createdAt,
          });
        }
      }
    });
  }

  return {
    location,
    entities: {
      associatedTrips,
      microblogs: directMicroblogs,
      photos: Array.from(photoMap.values()),
      movies: moviesWithMeta,
      people: associatedPeople,
    },
  };
}

export async function getLocationHubDataAction(slug: string): Promise<LocationHubData | null> {
  const cachedFn = createCachedQuery(
    () => fetchLocationHubDataRaw(slug),
    ["location-hub-data", slug],
    { tags: ["locations-list", `location-${slug}`], revalidate: 3600 }
  );

  return cachedFn();
}

export async function getLocationAssociatedEntities(locationId: string): Promise<LocationAssociatedEntities> {
  const loc = await fetchLocationByIdOrSlugRaw(locationId);
  if (!loc) return { associatedTrips: [], microblogs: [], photos: [], movies: [], people: [] };

  const hubData = await getLocationHubDataAction(loc.slug);
  return hubData?.entities || { associatedTrips: [], microblogs: [], photos: [], movies: [], people: [] };
}

export async function connectLocationToTrip(
  locationId: string,
  tripId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("trip", tripId, "location", locationId, "includes_location");
    
    purgeTag("locations-list");
    purgeTag("trips-list");

    const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
    if (loc[0]) {
      purgeTag(`location-${loc[0].slug}`);
      try {
        revalidatePath(`/locations/${loc[0].slug}`);
      } catch {}
    }
    if (tr[0]) {
      purgeTag(`trip-${tr[0].slug}`);
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

  purgeTag("locations-list");
  purgeTag("trips-list");

  if (locationSlug) {
    purgeTag(`location-${locationSlug}`);
    try {
      revalidatePath(`/locations/${locationSlug}`);
    } catch {}
  }
  if (tripSlug) {
    purgeTag(`trip-${tripSlug}`);
    try {
      revalidatePath(`/trips/${tripSlug}`);
    } catch {}
  }
  return { success: true };
}

export async function connectLocationToPersonAction(
  locationId: string,
  personId: string,
  relationship: string = "visited"
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("location", locationId, "person", personId, relationship);

    purgeTag("locations-list");
    purgeTag(`location-${locationId}`);
    purgeTag("people-list");
    purgeTag(`person-${personId}`);
    purgeTag(`person-connections-${personId}`);

    const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    if (loc[0]) {
      purgeTag(`location-${loc[0].slug}`);
      try {
        revalidatePath(`/locations/${loc[0].slug}`);
      } catch {}
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error connecting person to location:", err);
    return { success: false, error: err.message || "Failed to connect person to location" };
  }
}

export async function removeLocationPersonConnectionAction(
  relationshipId: string,
  locationSlug?: string,
  personId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await removeRelationship(relationshipId);

    purgeTag("locations-list");
    if (locationSlug) {
      purgeTag(`location-${locationSlug}`);
      try {
        revalidatePath(`/locations/${locationSlug}`);
      } catch {}
    }

    if (personId) {
      purgeTag("people-list");
      purgeTag(`person-${personId}`);
      purgeTag(`person-connections-${personId}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error removing location person connection:", err);
    return { success: false, error: err.message || "Failed to remove person connection" };
  }
}

export async function connectLocationPhotosBatchAction(
  locationId: string,
  photos: BatchPhotoConnectItem[],
  relationship: string = "taken_at"
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    for (const photo of photos) {
      if (photo.type === "gallery" && photo.id) {
        // Link via relationship table
        await addRelationship("location", locationId, "gallery", photo.id, relationship);

        // Also update gallery.locationId if currently null
        const gal = await db
          .select({ locationId: gallery.locationId })
          .from(gallery)
          .where(eq(gallery.id, photo.id))
          .limit(1);
        if (gal[0] && !gal[0].locationId) {
          await db.update(gallery).set({ locationId }).where(eq(gallery.id, photo.id));
        }
      } else if (photo.type === "cloudinary" && photo.url) {
        const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(attachments).values({
          id,
          entityType: "location",
          entityId: locationId,
          kind: "photo",
          url: photo.url,
          width: photo.width || null,
          height: photo.height || null,
          metadataJson: JSON.stringify({
            title: photo.title || photo.publicId || "Photo",
            publicId: photo.publicId,
            provider: "cloudinary",
          }),
          createdAt: now,
        });
      }
    }

    purgeTag("locations-list");
    purgeTag(`location-${locationId}`);

    const loc = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
    if (loc[0]) {
      purgeTag(`location-${loc[0].slug}`);
      try {
        revalidatePath(`/locations/${loc[0].slug}`);
      } catch {}
    }

    return { success: true, count: photos.length };
  } catch (err: any) {
    console.error("Error connecting photos to location in batch:", err);
    return { success: false, error: err.message || "Failed to connect photos" };
  }
}

export async function removeLocationPhotoConnectionAction(
  connectionId: string,
  locationId: string,
  locationSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();

    if (connectionId.startsWith("att_")) {
      await db.delete(attachments).where(eq(attachments.id, connectionId));
    } else if (connectionId.startsWith("rel_")) {
      await removeRelationship(connectionId);
    } else {
      // Direct gallery photo ID
      const gal = await db.select().from(gallery).where(eq(gallery.id, connectionId)).limit(1);
      if (gal[0] && gal[0].locationId === locationId) {
        await db.update(gallery).set({ locationId: null }).where(eq(gallery.id, connectionId));
      }
      // Also delete any relationship
      await db.delete(relationships).where(
        or(
          and(
            eq(relationships.sourceType, "location"),
            eq(relationships.sourceId, locationId),
            eq(relationships.targetType, "gallery"),
            eq(relationships.targetId, connectionId)
          ),
          and(
            eq(relationships.sourceType, "gallery"),
            eq(relationships.sourceId, connectionId),
            eq(relationships.targetType, "location"),
            eq(relationships.targetId, locationId)
          )
        )
      );
    }

    purgeTag("locations-list");
    purgeTag(`location-${locationId}`);
    if (locationSlug) {
      purgeTag(`location-${locationSlug}`);
      try {
        revalidatePath(`/locations/${locationSlug}`);
      } catch {}
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error disconnecting photo from location:", err);
    return { success: false, error: err.message || "Failed to disconnect photo" };
  }
}

export async function quickCreateLocationAction(data: {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  tripId?: string;
}): Promise<LocationPickerOption> {
  const loc = await createLocation({
    name: data.name,
    city: data.city,
    state: data.state,
    country: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
    visibility: "public",
  });

  if (data.tripId) {
    try {
      await addRelationship("trip", data.tripId, "location", loc.id, "includes_location");
      purgeTag("trips-list");
      purgeTag(`trip-${data.tripId}`);
    } catch (e) {
      console.error("Failed to associate quick-created location with trip:", e);
    }
  }

  return {
    id: loc.id,
    name: loc.name,
    city: loc.city,
    country: loc.country,
    latitude: loc.latitude,
    longitude: loc.longitude,
    favorite: false,
  };
}

export async function updateLocationCoordinatesAction(
  id: string,
  data: {
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    country?: string;
  }
): Promise<{ success: boolean; location?: LocationRecord; error?: string }> {
  try {
    await ensureDbInitialized();

    if (
      typeof data.latitude !== "number" ||
      typeof data.longitude !== "number" ||
      isNaN(data.latitude) ||
      isNaN(data.longitude)
    ) {
      return { success: false, error: "Invalid coordinates provided: latitude and longitude must be numbers." };
    }

    if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180) {
      return {
        success: false,
        error: "Coordinates out of bounds: latitude must be between -90 and 90, longitude between -180 and 180.",
      };
    }

    const existing = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
    if (!existing[0]) {
      return { success: false, error: `Location not found: ${id}` };
    }

    const now = new Date().toISOString();
    const updates: Partial<LocationRecord> = {
      latitude: data.latitude,
      longitude: data.longitude,
      updatedAt: now,
    };

    if (data.city !== undefined && data.city.trim()) {
      updates.city = data.city.trim();
    }
    if (data.state !== undefined && data.state.trim()) {
      updates.state = data.state.trim();
    }
    if (data.country !== undefined && data.country.trim()) {
      updates.country = data.country.trim();
    }

    await db.update(locations).set(updates).where(eq(locations.id, id));
    await logActivity(
      "location_updated",
      "location",
      id,
      `Updated GPS coordinates for ${existing[0].name}: ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`,
      { id, latitude: data.latitude, longitude: data.longitude }
    );

    purgeTag("locations-list");
    purgeTag(`location-${id}`);
    purgeTag(`location-${existing[0].slug}`);

    const updatedLoc = { ...existing[0], ...updates };
    eventBus.emit("entity.saved", {
      type: "location",
      id,
      title: updatedLoc.name,
      subtitle: [updatedLoc.city, updatedLoc.state, updatedLoc.country].filter(Boolean).join(", "),
      keywords: `${updatedLoc.name} ${updatedLoc.city || ""} ${updatedLoc.state || ""} ${updatedLoc.country || ""}`,
      url: `/locations`,
    });

    try {
      revalidatePath("/locations");
      revalidatePath(`/locations/${existing[0].slug}`);
    } catch {}

    const updatedRecord = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
    return { success: true, location: updatedRecord[0] || (updatedLoc as LocationRecord) };
  } catch (err: any) {
    console.error("Failed to update location coordinates:", err);
    return { success: false, error: err?.message || "Failed to update coordinates" };
  }
}

