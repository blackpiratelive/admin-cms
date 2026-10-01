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
  movieMetadata,
  traktMovies,
  relationships,
  persons,
  PersonRecord,
  attachments,
  tripDays,
  NewTripDay,
} from "@/db/schema";
import { desc, asc, eq, or, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { addRelationship, removeRelationship } from "@/features/relationships/actions";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import { eventBus } from "@/lib/event-bus";
import {
  computeTripDuration,
  formatTripDateRange,
  formatTripDisplayTitle,
  computeItineraryProgress,
  getDeterministicCoverTheme,
} from "./trip-helpers";
import { computeTripCostSummary, formatCostTotals, parseTripDay, buildDayRouteStops, sumRouteDistanceKm, formatDistanceKm } from "./day-helpers";
import type { TripOverviewItem, TripLocationCoordinate } from "./types";
import type { BatchPhotoConnectItem } from "@/components/PhotoPickerModal";

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
  data: Omit<Partial<TripRecord>, "tags"> & { tags?: string[] | string }
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

  const updatedRecord = { ...existing[0], ...updates };
  eventBus.emit("entity.saved", {
    type: "trip",
    id,
    title: updatedRecord.title,
    subtitle: updatedRecord.description || "Trip",
    keywords: `${updatedRecord.title} ${updatedRecord.description || ""} ${updatedRecord.tags}`,
    url: `/trips`,
  });

  return updatedRecord as TripRecord;
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

export interface TripPhotoItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  mediumUrl: string;
  originalUrl?: string;
  largeUrl?: string;
  width?: number | null;
  height?: number | null;
  sourceType: "direct" | "attachment" | "day";
  relationshipId?: string;
  sourceDay?: {
    id: string;
    dayNumber: number;
    title?: string | null;
  };
  createdAt?: string;
}

export interface TripAssociatedEntities {
  associatedLocations: Array<{ relationshipId?: string; location: LocationRecord }>;
  microblogs: Microblog[];
  photos: TripPhotoItem[];
  movies: any[];
  people: Array<{ relationshipId?: string; person: PersonRecord }>;
}

export interface TripHubData {
  trip: TripRecord | null;
  entities: TripAssociatedEntities;
  /** Geometric route distance in km (great-circle sum over itinerary stops). */
  routeDistanceKm: number;
}

async function fetchTripHubDataRaw(slug: string): Promise<TripHubData | null> {
  await ensureDbInitialized();

  const trip = await fetchTripByIdOrSlugRaw(slug);
  if (!trip) return null;

  const tripId = trip.id;

  // Execute direct lookups & relationship queries in 1 parallel batch!
  const [directMicroblogs, directPhotos, directMovieMeta, directAttachments, tripDaysRows, relRows] = await Promise.all([
    db.select().from(microblogs).where(eq(microblogs.tripId, tripId)),
    db.select().from(gallery).where(eq(gallery.tripId, tripId)),
    db.select().from(movieMetadata).where(eq(movieMetadata.tripId, tripId)),
    db.select().from(attachments).where(
      and(
        eq(attachments.entityType, "trip"),
        eq(attachments.entityId, tripId),
        eq(attachments.kind, "photo")
      )
    ),
    db.select().from(tripDays).where(eq(tripDays.tripId, tripId)),
    db.select().from(relationships).where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "location")),
        and(eq(relationships.sourceType, "location"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId)),
        and(eq(relationships.sourceType, "person"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId)),
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "person")),
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "gallery")),
        and(eq(relationships.sourceType, "gallery"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId))
      )
    ),
  ]);

  const movieTraktIds = directMovieMeta.map((m) => m.traktId);
  const moviesList = movieTraktIds.length > 0 ? await db.select().from(traktMovies).where(inArray(traktMovies.traktId, movieTraktIds)) : [];
  const metaMap = new Map(directMovieMeta.map((mm) => [mm.traktId, mm]));
  const moviesWithMeta = moviesList.map((m) => ({ ...m, personalMetadata: metaMap.get(m.traktId) }));

  const locRelMap = new Map<string, string>();
  const personRelMap = new Map<string, string>();
  const galleryRelMap = new Map<string, string>();
  const locIds: string[] = [];
  const personIds: string[] = [];
  const galleryRelIds: string[] = [];

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
    } else if (otherType === "gallery") {
      galleryRelIds.push(otherId);
      galleryRelMap.set(otherId, rel.id);
    }
  }

  const [locsRes, peopleRes, relGalleryRes] = await Promise.all([
    locIds.length > 0 ? db.select().from(locations).where(inArray(locations.id, locIds)) : Promise.resolve([]),
    personIds.length > 0 ? db.select().from(persons).where(inArray(persons.id, personIds)) : Promise.resolve([]),
    galleryRelIds.length > 0 ? db.select().from(gallery).where(inArray(gallery.id, galleryRelIds)) : Promise.resolve([]),
  ]);

  const associatedLocations = locsRes.map((l) => ({ relationshipId: locRelMap.get(l.id), location: l }));
  const associatedPeople = peopleRes.map((p) => ({ relationshipId: personRelMap.get(p.id), person: p }));

  // Route distance: geometric length of the itinerary route (km). Coordinates
  // come from the denormalized day JSON first, falling back to associated
  // location rows for any point referenced only by id.
  const locCoordMap = new Map(
    locsRes.map((l) => [l.id, { latitude: l.latitude, longitude: l.longitude }])
  );
  const routeDistanceKm = sumRouteDistanceKm(
    buildDayRouteStops(tripDaysRows, (id) => locCoordMap.get(id))
  );

  // Build a unified, de-duplicated photo list: direct gallery photos (gallery.tripId),
  // gallery photos linked via the relationship engine, and Cloudinary/uploaded attachments.
  const photoMap = new Map<string, TripPhotoItem>();

  for (const p of directPhotos) {
    photoMap.set(`gallery_${p.id}`, {
      id: p.id,
      title: p.title,
      thumbnailUrl: p.thumbnailUrl || p.mediumUrl || p.originalUrl,
      mediumUrl: p.mediumUrl || p.originalUrl,
      largeUrl: p.largeUrl,
      originalUrl: p.originalUrl,
      width: p.width,
      height: p.height,
      sourceType: "direct",
      createdAt: p.createdAt,
    });
  }

  for (const p of relGalleryRes) {
    const key = `gallery_${p.id}`;
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
        sourceType: "direct",
        relationshipId: galleryRelMap.get(p.id),
        createdAt: p.createdAt,
      });
    }
  }

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

  // Photos recorded inside the trip's itinerary days (trip_days.photosJson).
  // These are managed from the day editor, so they are read-only here.
  for (const day of tripDaysRows) {
    let parsedPhotos: Array<{ id?: string; url: string; caption?: string }> = [];
    try {
      const raw = JSON.parse(day.photosJson || "[]");
      if (Array.isArray(raw)) parsedPhotos = raw;
    } catch {}

    parsedPhotos.forEach((p, idx) => {
      if (!p.url) return;
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
          sourceType: "day",
          sourceDay: { id: day.id, dayNumber: day.dayNumber, title: day.title },
          createdAt: day.createdAt,
        });
      }
    });
  }

  return {
    trip,
    entities: {
      associatedLocations,
      microblogs: directMicroblogs,
      photos: Array.from(photoMap.values()),
      movies: moviesWithMeta,
      people: associatedPeople,
    },
    routeDistanceKm,
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

export async function connectTripPhotosBatchAction(
  tripId: string,
  photos: BatchPhotoConnectItem[],
  relationship: string = "taken_at"
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    for (const photo of photos) {
      if (photo.type === "gallery" && photo.id) {
        // Link via relationship table
        await addRelationship("trip", tripId, "gallery", photo.id, relationship);

        // Also update gallery.tripId if currently null
        const gal = await db
          .select({ tripId: gallery.tripId })
          .from(gallery)
          .where(eq(gallery.id, photo.id))
          .limit(1);
        if (gal[0] && !gal[0].tripId) {
          await db.update(gallery).set({ tripId }).where(eq(gallery.id, photo.id));
        }
      } else if (photo.type === "cloudinary" && photo.url) {
        const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(attachments).values({
          id,
          entityType: "trip",
          entityId: tripId,
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

    purgeTag("trips-list");
    purgeTag(`trip-${tripId}`);

    const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
    if (tr[0]) {
      purgeTag(`trip-${tr[0].slug}`);
      try {
        revalidatePath(`/trips/${tr[0].slug}`);
      } catch {}
    }

    return { success: true, count: photos.length };
  } catch (err: any) {
    console.error("Error connecting photos to trip in batch:", err);
    return { success: false, error: err.message || "Failed to connect photos" };
  }
}

export async function removeTripPhotoConnectionAction(
  connectionId: string,
  tripId: string,
  tripSlug?: string
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
      if (gal[0] && gal[0].tripId === tripId) {
        await db.update(gallery).set({ tripId: null }).where(eq(gallery.id, connectionId));
      }
      // Also delete any relationship linking this photo to the trip
      await db.delete(relationships).where(
        or(
          and(
            eq(relationships.sourceType, "trip"),
            eq(relationships.sourceId, tripId),
            eq(relationships.targetType, "gallery"),
            eq(relationships.targetId, connectionId)
          ),
          and(
            eq(relationships.sourceType, "gallery"),
            eq(relationships.sourceId, connectionId),
            eq(relationships.targetType, "trip"),
            eq(relationships.targetId, tripId)
          )
        )
      );
    }

    purgeTag("trips-list");
    purgeTag(`trip-${tripId}`);
    if (tripSlug) {
      purgeTag(`trip-${tripSlug}`);
      try {
        revalidatePath(`/trips/${tripSlug}`);
      } catch {}
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error disconnecting photo from trip:", err);
    return { success: false, error: err.message || "Failed to disconnect photo" };
  }
}

/**
 * High-performance batch query for the Trips dashboard.
 * Eliminates N+1 queries by fetching trips, days, relationships, gallery,
 * and attachments in parallel batches in 1 round-trip.
 */
async function fetchTripsOverviewRaw(): Promise<TripOverviewItem[]> {
  await ensureDbInitialized();

  const allTrips = await db
    .select()
    .from(trips)
    .orderBy(desc(trips.startDate), desc(trips.createdAt));

  if (allTrips.length === 0) return [];

  const tripIds = allTrips.map((t) => t.id);

  // Parallel batch queries
  const [allDays, allRels, allAttachments, allGallery] = await Promise.all([
    db
      .select()
      .from(tripDays)
      .where(inArray(tripDays.tripId, tripIds))
      .orderBy(asc(tripDays.dayNumber)),
    db
      .select()
      .from(relationships)
      .where(
        or(
          and(
            eq(relationships.sourceType, "trip"),
            inArray(relationships.sourceId, tripIds),
            eq(relationships.targetType, "location")
          ),
          and(
            eq(relationships.targetType, "trip"),
            inArray(relationships.targetId, tripIds),
            eq(relationships.sourceType, "location")
          )
        )
      ),
    db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.entityType, "trip"),
          inArray(attachments.entityId, tripIds)
        )
      ),
    db
      .select()
      .from(gallery)
      .where(inArray(gallery.tripId, tripIds)),
  ]);

  // Extract all referenced location IDs to query locations in a single batch
  const referencedLocIds = new Set<string>();
  for (const rel of allRels) {
    const locId = rel.sourceType === "location" ? rel.sourceId : rel.targetId;
    if (locId) referencedLocIds.add(locId);
  }
  for (const d of allDays) {
    if (d.primaryLocationId) referencedLocIds.add(d.primaryLocationId);
    try {
      const parsed = parseTripDay(d);
      for (const t of parsed.transport) {
        if (t.fromLocationId) referencedLocIds.add(t.fromLocationId);
        if (t.toLocationId) referencedLocIds.add(t.toLocationId);
        if (t.waypoints) {
          for (const wp of t.waypoints) {
            if (wp.locationId) referencedLocIds.add(wp.locationId);
          }
        }
      }
      for (const m of parsed.meals) {
        if (m.placeLocationId) referencedLocIds.add(m.placeLocationId);
      }
      for (const a of parsed.activities) {
        if (a.locationId) referencedLocIds.add(a.locationId);
      }
      if (parsed.accommodation?.locationId) {
        referencedLocIds.add(parsed.accommodation.locationId);
      }
    } catch {}
  }

  const locIdArray = Array.from(referencedLocIds);
  const allLocations =
    locIdArray.length > 0
      ? await db.select().from(locations).where(inArray(locations.id, locIdArray))
      : [];

  const locNameMap = new Map<string, string>();
  for (const l of allLocations) {
    locNameMap.set(l.id, l.name);
  }

  // Group fetched data by tripId
  const daysByTrip = new Map<string, typeof allDays>();
  for (const d of allDays) {
    const list = daysByTrip.get(d.tripId) || [];
    list.push(d);
    daysByTrip.set(d.tripId, list);
  }

  const relLocIdsByTrip = new Map<string, string[]>();
  for (const rel of allRels) {
    const tId = rel.sourceType === "trip" ? rel.sourceId : rel.targetId;
    const lId = rel.sourceType === "location" ? rel.sourceId : rel.targetId;
    const list = relLocIdsByTrip.get(tId) || [];
    list.push(lId);
    relLocIdsByTrip.set(tId, list);
  }

  const attachmentsByTrip = new Map<string, typeof allAttachments>();
  for (const att of allAttachments) {
    const list = attachmentsByTrip.get(att.entityId) || [];
    list.push(att);
    attachmentsByTrip.set(att.entityId, list);
  }

  const galleryByTrip = new Map<string, typeof allGallery>();
  for (const g of allGallery) {
    if (g.tripId) {
      const list = galleryByTrip.get(g.tripId) || [];
      list.push(g);
      galleryByTrip.set(g.tripId, list);
    }
  }

  // Construct enriched overview items
  return allTrips.map((t): TripOverviewItem => {
    const tripDaysList = daysByTrip.get(t.id) || [];
    const tripAtts = attachmentsByTrip.get(t.id) || [];
    const tripGalleryList = galleryByTrip.get(t.id) || [];
    const tripRelLocIds = relLocIdsByTrip.get(t.id) || [];

    // 1. Durations and dates
    const duration = computeTripDuration(t.startDate, t.endDate);
    const dateRangeFormatted = formatTripDateRange(t.startDate, t.endDate);
    const displayTitle = formatTripDisplayTitle(t.title);

    // 2. Spend calculation
    const costSummary = computeTripCostSummary(tripDaysList);
    const spendFormatted = formatCostTotals(costSummary.total) || null;

    // 2b. Route distance (geometric length of the itinerary route, km)
    const distanceKm = sumRouteDistanceKm(buildDayRouteStops(tripDaysList));
    const distanceFormatted = formatDistanceKm(distanceKm, { approx: true }) || null;

    // 3. Location names
    const orderedLocNames: string[] = [];
    const seenLocNames = new Set<string>();

    const addLocName = (name?: string | null) => {
      if (!name) return;
      const clean = name.trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (!seenLocNames.has(lower)) {
        seenLocNames.add(lower);
        orderedLocNames.push(clean);
      }
    };

    // Primary locations from days
    for (const d of tripDaysList) {
      if (d.primaryLocationId && locNameMap.has(d.primaryLocationId)) {
        addLocName(locNameMap.get(d.primaryLocationId));
      } else if (d.primaryLocationName) {
        addLocName(d.primaryLocationName);
      }
    }

    // Direct location relationships
    for (const lId of tripRelLocIds) {
      if (locNameMap.has(lId)) {
        addLocName(locNameMap.get(lId));
      }
    }

    // Transport/activity locations from days
    for (const d of tripDaysList) {
      try {
        const parsed = parseTripDay(d);
        for (const tr of parsed.transport) {
          if (tr.fromLocationId) addLocName(locNameMap.get(tr.fromLocationId));
          else if (tr.fromName) addLocName(tr.fromName);
          if (tr.waypoints) {
            for (const wp of tr.waypoints) {
              if (wp.locationId) addLocName(locNameMap.get(wp.locationId));
              else if (wp.name) addLocName(wp.name);
            }
          }
          if (tr.toLocationId) addLocName(locNameMap.get(tr.toLocationId));
          else if (tr.toName) addLocName(tr.toName);
        }
      } catch {}
    }

    // 4. Photos count & Cover image resolution
    let dayPhotosCount = 0;
    let dayPhotoFirstUrl: string | null = null;
    for (const d of tripDaysList) {
      try {
        const parsed = parseTripDay(d);
        if (parsed.photos && parsed.photos.length > 0) {
          dayPhotosCount += parsed.photos.length;
          if (!dayPhotoFirstUrl && parsed.photos[0]?.url) {
            dayPhotoFirstUrl = parsed.photos[0].url;
          }
        }
      } catch {}
    }

    const photoAtts = tripAtts.filter((a) => a.kind === "photo");
    const totalPhotos = tripGalleryList.length + photoAtts.length + dayPhotosCount;

    // Deterministic cover hierarchy:
    // 1. Attachment cover
    // 2. Attachment hero
    // 3. Attachment photo
    // 4. Gallery photo
    // 5. Day photo
    // 6. null (uses fallbackCoverTheme)
    let coverUrl: string | null = null;
    const coverAtt = tripAtts.find((a) => a.kind === "cover");
    const heroAtt = tripAtts.find((a) => a.kind === "hero");

    if (coverAtt?.url) {
      coverUrl = coverAtt.url;
    } else if (heroAtt?.url) {
      coverUrl = heroAtt.url;
    } else if (photoAtts[0]?.url) {
      coverUrl = photoAtts[0].url;
    } else if (tripGalleryList[0]) {
      const g = tripGalleryList[0];
      coverUrl = g.mediumUrl || g.thumbnailUrl || g.largeUrl || g.originalUrl;
    } else if (dayPhotoFirstUrl) {
      coverUrl = dayPhotoFirstUrl;
    }

    // 5. Itinerary progress
    // Count days that have documented content (or all days if created)
    let documentedDaysCount = 0;
    for (const d of tripDaysList) {
      let isDocumented = Boolean(
        d.title ||
        d.primaryLocationId ||
        d.primaryLocationName ||
        d.weather ||
        d.mood ||
        d.notesMarkdown
      );
      if (!isDocumented) {
        try {
          const parsed = parseTripDay(d);
          isDocumented =
            parsed.transport.length > 0 ||
            parsed.meals.length > 0 ||
            parsed.activities.length > 0 ||
            Boolean(parsed.accommodation?.name || parsed.accommodation?.locationId) ||
            parsed.photos.length > 0;
        } catch {}
      }
      if (isDocumented) documentedDaysCount += 1;
    }

    // If day records exist, use that as base; if dates are set, expected is duration
    const expectedDays = t.startDate && t.endDate ? duration : Math.max(1, tripDaysList.length);
    const plannedDays = Math.min(expectedDays, Math.max(documentedDaysCount, tripDaysList.length));
    const progressPercent = computeItineraryProgress(plannedDays, expectedDays);

    let parsedTags: string[] = [];
    try {
      parsedTags = t.tags ? JSON.parse(t.tags) : [];
    } catch {
      parsedTags = [];
    }

    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      displayTitle,
      description: t.description,
      startDate: t.startDate,
      endDate: t.endDate,
      dateRangeFormatted,
      duration,
      status: t.status,
      visibility: t.visibility,
      favorite: t.favorite === 1,
      tags: parsedTags,
      placesCount: Math.max(orderedLocNames.length, tripRelLocIds.length),
      locationNames: orderedLocNames,
      photosCount: totalPhotos,
      coverImageUrl: coverUrl,
      fallbackCoverTheme: getDeterministicCoverTheme(t.id || t.slug),
      itineraryTotalDays: expectedDays,
      itineraryPlannedDays: plannedDays,
      itineraryProgressPercent: progressPercent,
      spendFormatted,
      spendTotals: costSummary.total,
      distanceKm,
      distanceFormatted,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  });
}

export async function getTripsOverviewAction(): Promise<TripOverviewItem[]> {
  const cachedFn = createCachedQuery(
    fetchTripsOverviewRaw,
    ["trips-overview"],
    { tags: ["trips-list"], revalidate: 3600 }
  );

  return cachedFn();
}

/**
 * Duplicate a trip, cloning its metadata, itinerary days, and location relationships.
 */
export async function duplicateTripAction(tripId: string): Promise<TripRecord | null> {
  await ensureDbInitialized();

  const existing = (await db.select().from(trips).where(eq(trips.id, tripId)).limit(1))[0];
  if (!existing) return null;

  const now = new Date().toISOString();
  const randSuffix = Math.random().toString(36).substring(2, 6);
  const newId = `trip_${Date.now()}_${randSuffix}`;
  const newSlug = `${existing.slug}-copy-${randSuffix}`;
  const newTitle = `${existing.title} (Copy)`;

  const newTripRow: NewTrip = {
    id: newId,
    title: newTitle,
    slug: newSlug,
    description: existing.description,
    startDate: existing.startDate,
    endDate: existing.endDate,
    status: existing.status,
    visibility: existing.visibility,
    favorite: 0,
    tags: existing.tags,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(trips).values(newTripRow);

  // Duplicate trip days
  const existingDays = await db.select().from(tripDays).where(eq(tripDays.tripId, tripId));
  if (existingDays.length > 0) {
    const clonedDays: NewTripDay[] = existingDays.map((d) => ({
      id: `tripday_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tripId: newId,
      dayNumber: d.dayNumber,
      date: d.date,
      title: d.title,
      primaryLocationId: d.primaryLocationId,
      primaryLocationName: d.primaryLocationName,
      transportJson: d.transportJson,
      mealsJson: d.mealsJson,
      activitiesJson: d.activitiesJson,
      accommodationJson: d.accommodationJson,
      photosJson: d.photosJson,
      weather: d.weather,
      mood: d.mood,
      notesMarkdown: d.notesMarkdown,
      createdAt: now,
      updatedAt: now,
    }));
    await db.insert(tripDays).values(clonedDays);
  }

  // Duplicate location relationships
  const existingRels = await db.select().from(relationships).where(
    or(
      and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId)),
      and(eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId))
    )
  );

  for (const rel of existingRels) {
    const isSource = rel.sourceType === "trip" && rel.sourceId === tripId;
    try {
      await addRelationship(
        isSource ? "trip" : rel.sourceType,
        isSource ? newId : rel.sourceId,
        isSource ? rel.targetType : "trip",
        isSource ? rel.targetId : newId,
        rel.relationship
      );
    } catch {}
  }

  purgeTag("trips-list");
  try {
    revalidatePath("/trips");
  } catch {}

  await logActivity("trip_created", "trip", newId, `Duplicated Trip: ${newTitle}`, { slug: newSlug });

  return newTripRow as TripRecord;
}

/**
 * Direct toggle for favorite status with instant cache purging.
 */
export async function toggleTripFavoriteAction(
  tripId: string,
  favorite: boolean
): Promise<{ success: boolean; favorite: boolean }> {
  await ensureDbInitialized();

  const tr = (await db.select().from(trips).where(eq(trips.id, tripId)).limit(1))[0];
  if (!tr) return { success: false, favorite: false };

  const val = favorite ? 1 : 0;
  await db.update(trips).set({ favorite: val, updatedAt: new Date().toISOString() }).where(eq(trips.id, tripId));

  purgeTag("trips-list");
  purgeTag(`trip-${tripId}`);
  purgeTag(`trip-${tr.slug}`);

  try {
    revalidatePath("/trips");
    revalidatePath(`/trips/${tr.slug}`);
  } catch {}

  return { success: true, favorite };
}

/**
 * Fetch ordered locations with coordinates for the Map tab.
 */
export async function getTripMapLocationsAction(
  slugOrId: string
): Promise<{
  orderedLocations: TripLocationCoordinate[];
  routeStops: TripLocationCoordinate[];
  associatedLocations: TripLocationCoordinate[];
  missingCoords: TripLocationCoordinate[];
  routeDistanceKm: number;
}> {
  await ensureDbInitialized();

  const tr = await fetchTripByIdOrSlugRaw(slugOrId);
  if (!tr) {
    return {
      orderedLocations: [],
      routeStops: [],
      associatedLocations: [],
      missingCoords: [],
      routeDistanceKm: 0,
    };
  }

  const [daysList, relsList] = await Promise.all([
    db.select().from(tripDays).where(eq(tripDays.tripId, tr.id)).orderBy(asc(tripDays.dayNumber)),
    db.select().from(relationships).where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tr.id), eq(relationships.targetType, "location")),
        and(eq(relationships.targetType, "trip"), eq(relationships.targetId, tr.id), eq(relationships.sourceType, "location"))
      )
    ),
  ]);

  // 1. Collect all referenced location IDs from days and relationships
  const referencedLocIds = new Set<string>();
  const associatedLocIds = new Set<string>();

  for (const rel of relsList) {
    const locId = rel.sourceType === "location" ? rel.sourceId : rel.targetId;
    referencedLocIds.add(locId);
    associatedLocIds.add(locId);
  }

  for (const d of daysList) {
    if (d.primaryLocationId) referencedLocIds.add(d.primaryLocationId);
    try {
      const parsed = parseTripDay(d);
      for (const t of parsed.transport) {
        if (t.fromLocationId) referencedLocIds.add(t.fromLocationId);
        if (t.toLocationId) referencedLocIds.add(t.toLocationId);
        if (t.waypoints) {
          for (const wp of t.waypoints) {
            if (wp.locationId) referencedLocIds.add(wp.locationId);
          }
        }
      }
      for (const m of parsed.meals) {
        if (m.placeLocationId) referencedLocIds.add(m.placeLocationId);
      }
      for (const a of parsed.activities) {
        if (a.locationId) referencedLocIds.add(a.locationId);
      }
      if (parsed.accommodation?.locationId) {
        referencedLocIds.add(parsed.accommodation.locationId);
      }
    } catch {}
  }

  const locRows =
    referencedLocIds.size > 0
      ? await db.select().from(locations).where(inArray(locations.id, Array.from(referencedLocIds)))
      : [];
  const locMap = new Map(locRows.map((l) => [l.id, l]));

  // 2. Build chronological itinerary route stops
  type RawStop = {
    id: string;
    name: string;
    slug: string;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    latitude: number | null;
    longitude: number | null;
    dayNumber?: number | null;
    stopType?: TripLocationCoordinate["stopType"];
    isAssociatedLocation?: boolean;
    locationId?: string;
    transportMode?: TripLocationCoordinate["transportMode"];
  };

  const rawStops: RawStop[] = [];
  const missingCoords: TripLocationCoordinate[] = [];
  const missingSeen = new Set<string>();

  const trackMissing = (item: TripLocationCoordinate) => {
    if (!missingSeen.has(item.id)) {
      missingSeen.add(item.id);
      missingCoords.push(item);
    }
  };

  for (const d of daysList) {
    const parsed = parseTripDay(d);

    // Primary location
    if (d.primaryLocationId || d.primaryLocationName) {
      const loc = d.primaryLocationId ? locMap.get(d.primaryLocationId) : undefined;
      const lat = d.primaryLocationLat ?? loc?.latitude ?? null;
      const lng = d.primaryLocationLng ?? loc?.longitude ?? null;
      const name = d.primaryLocationName || loc?.name || `Day ${d.dayNumber}`;
      const id = loc?.id || `day_primary_${d.id}`;
      const isAssoc = !!(loc?.id && associatedLocIds.has(loc.id));

      if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        rawStops.push({
          id,
          name,
          slug: loc?.slug || "",
          city: loc?.city,
          state: loc?.state,
          country: loc?.country,
          latitude: lat,
          longitude: lng,
          dayNumber: d.dayNumber,
          stopType: "primary",
          isAssociatedLocation: isAssoc,
          locationId: loc?.id,
        });
      } else if (loc) {
        trackMissing({
          id: loc.id,
          name: loc.name,
          slug: loc.slug,
          city: loc.city,
          state: loc.state,
          country: loc.country,
          latitude: null,
          longitude: null,
          order: 0,
        });
      }
    }

    // Transport legs
    for (const leg of parsed.transport) {
      // From leg
      if (leg.fromLocationId || leg.fromName || leg.fromLat != null) {
        const fromLoc = leg.fromLocationId ? locMap.get(leg.fromLocationId) : undefined;
        const lat = leg.fromLat ?? fromLoc?.latitude ?? null;
        const lng = leg.fromLng ?? fromLoc?.longitude ?? null;
        const name = leg.fromName || fromLoc?.name || "Departure";
        const id = fromLoc?.id || `leg_from_${leg.id}`;
        const isAssoc = !!(fromLoc?.id && associatedLocIds.has(fromLoc.id));

        if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          rawStops.push({
            id,
            name,
            slug: fromLoc?.slug || "",
            city: fromLoc?.city,
            state: fromLoc?.state,
            country: fromLoc?.country,
            latitude: lat,
            longitude: lng,
            dayNumber: d.dayNumber,
            stopType: "transport_from",
            isAssociatedLocation: isAssoc,
            locationId: fromLoc?.id,
            transportMode: leg.mode,
          });
        } else if (fromLoc) {
          trackMissing({
            id: fromLoc.id,
            name: fromLoc.name,
            slug: fromLoc.slug,
            city: fromLoc.city,
            state: fromLoc.state,
            country: fromLoc.country,
            latitude: null,
            longitude: null,
            order: 0,
          });
        }
      }

      // Intermediate Waypoints / Cities (Via stops)
      if (leg.waypoints && Array.isArray(leg.waypoints)) {
        for (const wp of leg.waypoints) {
          if (wp.locationId || wp.name || wp.latitude != null) {
            const wpLoc = wp.locationId ? locMap.get(wp.locationId) : undefined;
            const lat = wp.latitude ?? wpLoc?.latitude ?? null;
            const lng = wp.longitude ?? wpLoc?.longitude ?? null;
            const name = wp.name || wpLoc?.name || "Waypoint";
            const id = wpLoc?.id || `leg_wp_${wp.id}`;
            const isAssoc = !!(wpLoc?.id && associatedLocIds.has(wpLoc.id));

            if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
              rawStops.push({
                id,
                name,
                slug: wpLoc?.slug || "",
                city: wpLoc?.city,
                state: wpLoc?.state,
                country: wpLoc?.country,
                latitude: lat,
                longitude: lng,
                dayNumber: d.dayNumber,
                stopType: "transport_waypoint",
                isAssociatedLocation: isAssoc,
                locationId: wpLoc?.id,
                transportMode: leg.mode,
              });
            } else if (wpLoc) {
              trackMissing({
                id: wpLoc.id,
                name: wpLoc.name,
                slug: wpLoc.slug,
                city: wpLoc.city,
                state: wpLoc.state,
                country: wpLoc.country,
                latitude: null,
                longitude: null,
                order: 0,
              });
            }
          }
        }
      }

      // To leg
      if (leg.toLocationId || leg.toName || leg.toLat != null) {
        const toLoc = leg.toLocationId ? locMap.get(leg.toLocationId) : undefined;
        const lat = leg.toLat ?? toLoc?.latitude ?? null;
        const lng = leg.toLng ?? toLoc?.longitude ?? null;
        const name = leg.toName || toLoc?.name || "Arrival";
        const id = toLoc?.id || `leg_to_${leg.id}`;
        const isAssoc = !!(toLoc?.id && associatedLocIds.has(toLoc.id));

        if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          rawStops.push({
            id,
            name,
            slug: toLoc?.slug || "",
            city: toLoc?.city,
            state: toLoc?.state,
            country: toLoc?.country,
            latitude: lat,
            longitude: lng,
            dayNumber: d.dayNumber,
            stopType: "transport_to",
            isAssociatedLocation: isAssoc,
            locationId: toLoc?.id,
            transportMode: leg.mode,
          });
        } else if (toLoc) {
          trackMissing({
            id: toLoc.id,
            name: toLoc.name,
            slug: toLoc.slug,
            city: toLoc.city,
            state: toLoc.state,
            country: toLoc.country,
            latitude: null,
            longitude: null,
            order: 0,
          });
        }
      }
    }

    // Activities
    for (const act of parsed.activities) {
      if (act.locationId || act.locationName || act.lat != null) {
        const actLoc = act.locationId ? locMap.get(act.locationId) : undefined;
        const lat = act.lat ?? actLoc?.latitude ?? null;
        const lng = act.lng ?? actLoc?.longitude ?? null;
        const name = act.title || act.locationName || actLoc?.name || "Activity";
        const id = actLoc?.id || `act_${act.id}`;
        const isAssoc = !!(actLoc?.id && associatedLocIds.has(actLoc.id));

        if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          rawStops.push({
            id,
            name,
            slug: actLoc?.slug || "",
            city: actLoc?.city,
            state: actLoc?.state,
            country: actLoc?.country,
            latitude: lat,
            longitude: lng,
            dayNumber: d.dayNumber,
            stopType: "activity",
            isAssociatedLocation: isAssoc,
            locationId: actLoc?.id,
          });
        } else if (actLoc) {
          trackMissing({
            id: actLoc.id,
            name: actLoc.name,
            slug: actLoc.slug,
            city: actLoc.city,
            state: actLoc.state,
            country: actLoc.country,
            latitude: null,
            longitude: null,
            order: 0,
          });
        }
      }
    }

    // Meals
    for (const meal of parsed.meals) {
      if (meal.placeLocationId || meal.place || meal.lat != null) {
        const mealLoc = meal.placeLocationId ? locMap.get(meal.placeLocationId) : undefined;
        const lat = meal.lat ?? mealLoc?.latitude ?? null;
        const lng = meal.lng ?? mealLoc?.longitude ?? null;
        const name = meal.place || mealLoc?.name || "Meal";
        const id = mealLoc?.id || `meal_${meal.id}`;
        const isAssoc = !!(mealLoc?.id && associatedLocIds.has(mealLoc.id));

        if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          rawStops.push({
            id,
            name,
            slug: mealLoc?.slug || "",
            city: mealLoc?.city,
            state: mealLoc?.state,
            country: mealLoc?.country,
            latitude: lat,
            longitude: lng,
            dayNumber: d.dayNumber,
            stopType: "meal",
            isAssociatedLocation: isAssoc,
            locationId: mealLoc?.id,
          });
        } else if (mealLoc) {
          trackMissing({
            id: mealLoc.id,
            name: mealLoc.name,
            slug: mealLoc.slug,
            city: mealLoc.city,
            state: mealLoc.state,
            country: mealLoc.country,
            latitude: null,
            longitude: null,
            order: 0,
          });
        }
      }
    }

    // Accommodation
    if (parsed.accommodation) {
      const acc = parsed.accommodation;
      if (acc.locationId || acc.name || acc.locationName || acc.lat != null) {
        const accLoc = acc.locationId ? locMap.get(acc.locationId) : undefined;
        const lat = acc.lat ?? accLoc?.latitude ?? null;
        const lng = acc.lng ?? accLoc?.longitude ?? null;
        const name = acc.name || acc.locationName || accLoc?.name || "Stay";
        const id = accLoc?.id || `acc_${d.id}`;
        const isAssoc = !!(accLoc?.id && associatedLocIds.has(accLoc.id));

        if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          rawStops.push({
            id,
            name,
            slug: accLoc?.slug || "",
            city: accLoc?.city,
            state: accLoc?.state,
            country: accLoc?.country,
            latitude: lat,
            longitude: lng,
            dayNumber: d.dayNumber,
            stopType: "accommodation",
            isAssociatedLocation: isAssoc,
            locationId: accLoc?.id,
          });
        } else if (accLoc) {
          trackMissing({
            id: accLoc.id,
            name: accLoc.name,
            slug: accLoc.slug,
            city: accLoc.city,
            state: accLoc.state,
            country: accLoc.country,
            latitude: null,
            longitude: null,
            order: 0,
          });
        }
      }
    }
  }

  // Deduplicate consecutive identical stops to avoid redundant zero-distance hops
  const collapsedStops: RawStop[] = [];
  for (const s of rawStops) {
    const prev = collapsedStops[collapsedStops.length - 1];
    if (
      prev &&
      ((prev.locationId && s.locationId && prev.locationId === s.locationId) ||
        (prev.latitude === s.latitude && prev.longitude === s.longitude))
    ) {
      if (s.isAssociatedLocation) prev.isAssociatedLocation = true;
      continue;
    }
    collapsedStops.push(s);
  }

  // 3. Build routeStops with sequential order
  const routeStops: TripLocationCoordinate[] = collapsedStops.map((s, idx) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    city: s.city,
    state: s.state,
    country: s.country,
    latitude: s.latitude,
    longitude: s.longitude,
    order: idx + 1,
    isPrimary: idx === 0,
    dayNumber: s.dayNumber,
    stopType: s.stopType,
    isAssociatedLocation: s.isAssociatedLocation,
    transportMode: s.transportMode,
  }));

  // 4. Build associated locations
  const associatedLocations: TripLocationCoordinate[] = [];
  const routeLocationIds = new Set(routeStops.map((r) => r.id));

  let assocOrder = routeStops.length + 1;
  for (const locId of associatedLocIds) {
    const loc = locMap.get(locId);
    if (!loc) continue;

    if (
      loc.latitude !== null &&
      loc.longitude !== null &&
      !Number.isNaN(loc.latitude) &&
      !Number.isNaN(loc.longitude)
    ) {
      const existingInRoute = routeStops.find((r) => r.id === loc.id);
      if (existingInRoute) {
        existingInRoute.isAssociatedLocation = true;
        associatedLocations.push(existingInRoute);
      } else {
        const item: TripLocationCoordinate = {
          id: loc.id,
          name: loc.name,
          slug: loc.slug,
          city: loc.city,
          state: loc.state,
          country: loc.country,
          latitude: loc.latitude,
          longitude: loc.longitude,
          order: assocOrder++,
          isPrimary: false,
          stopType: "associated",
          isAssociatedLocation: true,
        };
        associatedLocations.push(item);
      }
    } else {
      trackMissing({
        id: loc.id,
        name: loc.name,
        slug: loc.slug,
        city: loc.city,
        state: loc.state,
        country: loc.country,
        latitude: null,
        longitude: null,
        order: 0,
      });
    }
  }

  // Any associated locations not already in routeStops are included in orderedLocations for map display
  const extraAssocStops = associatedLocations.filter((a) => !routeLocationIds.has(a.id));
  const orderedLocations: TripLocationCoordinate[] = [...routeStops, ...extraAssocStops];

  // Renumber missing coords orders
  missingCoords.forEach((m, i) => {
    m.order = i + 1;
  });

  // Geometric route length over the drawn itinerary stops (km).
  const routeDistanceKm = sumRouteDistanceKm(routeStops);

  return { orderedLocations, routeStops, associatedLocations, missingCoords, routeDistanceKm };
}

/**
 * Retrieve Mapbox token configured on server or client.
 */
export async function getMapboxTokenAction(): Promise<string | null> {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN || null;
}

/** Connect a person to a trip via the Relationship Engine. */
export async function connectTripToPerson(
  tripId: string,
  personId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await addRelationship("trip", tripId, "person", personId, "shared_with");

    purgeTag("trips-list");
    purgeTag(`trip-${tripId}`);
    const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
    if (tr[0]) {
      purgeTag(`trip-${tr[0].slug}`);
      try {
        revalidatePath(`/trips/${tr[0].slug}`);
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect person to trip" };
  }
}

/** Remove a trip↔entity relationship by its relationship id, purging caches. */
export async function removeTripConnectionAction(
  relationshipId: string,
  tripId: string,
  tripSlug?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureDbInitialized();
    await removeRelationship(relationshipId);

    purgeTag("trips-list");
    purgeTag("locations-list");
    purgeTag(`trip-${tripId}`);
    if (tripSlug) {
      purgeTag(`trip-${tripSlug}`);
      try {
        revalidatePath(`/trips/${tripSlug}`);
      } catch {}
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to remove connection" };
  }
}
