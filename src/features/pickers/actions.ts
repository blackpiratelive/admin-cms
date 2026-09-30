"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  locations,
  trips,
  microblogs,
  gallery,
  tripDays,
  movieMetadata,
  tvShowMetadata,
  journalEntries,
  relationships,
} from "@/db/schema";
import { asc, desc, isNotNull, eq, or, and } from "drizzle-orm";
import { createCachedQuery } from "@/lib/server-cache";
import type {
  LocationPickerData,
  LocationPickerOption,
  TripPickerData,
  TripPickerOption,
} from "./types";

const RECENT_LIMIT = 6;
// How many rows to scan per usage source when deriving recents. Small tables,
// cheap indexed scans; merged + deduped in memory afterwards.
const SOURCE_SCAN_LIMIT = 30;

// ---------------------------------------------------------------------------
// Lightweight option projections (id + label fields only, not full rows).
// Cached under the same tags the location/trip mutations already purge, so the
// picker never ships private notes / camera recs / etc. just to render a label.
// ---------------------------------------------------------------------------

async function fetchLocationOptionsRaw(): Promise<LocationPickerOption[]> {
  await ensureDbInitialized();
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      city: locations.city,
      country: locations.country,
      latitude: locations.latitude,
      longitude: locations.longitude,
      favorite: locations.favorite,
    })
    .from(locations)
    .orderBy(asc(locations.name));
  return rows.map((r) => ({ ...r, favorite: !!r.favorite }));
}

async function fetchTripOptionsRaw(): Promise<TripPickerOption[]> {
  await ensureDbInitialized();
  const rows = await db
    .select({
      id: trips.id,
      title: trips.title,
      startDate: trips.startDate,
      favorite: trips.favorite,
    })
    .from(trips)
    .orderBy(desc(trips.startDate));
  return rows.map((r) => ({ ...r, favorite: !!r.favorite }));
}

// ---------------------------------------------------------------------------
// Recents derivation. "Recently used" = most recently touched rows across every
// table that references a location/trip. ISO timestamps compare lexicographically,
// so we keep the max per id and take the newest few. Not cached (cheap + should
// reflect the latest association immediately).
// ---------------------------------------------------------------------------

function mergeRecent(
  rows: Array<{ id: string | null; ts: string }>[],
  limit: number
): string[] {
  const newest = new Map<string, string>();
  for (const source of rows) {
    for (const row of source) {
      if (!row.id) continue;
      const prev = newest.get(row.id);
      if (!prev || row.ts > prev) newest.set(row.id, row.ts);
    }
  }
  return [...newest.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, limit)
    .map(([id]) => id);
}

async function deriveRecentLocationIds(): Promise<string[]> {
  await ensureDbInitialized();
  const [mb, gal, td, mv, tv, je] = await Promise.all([
    db.select({ id: microblogs.locationId, ts: microblogs.updatedAt }).from(microblogs).where(isNotNull(microblogs.locationId)).orderBy(desc(microblogs.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: gallery.locationId, ts: gallery.updatedAt }).from(gallery).where(isNotNull(gallery.locationId)).orderBy(desc(gallery.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: tripDays.primaryLocationId, ts: tripDays.updatedAt }).from(tripDays).where(isNotNull(tripDays.primaryLocationId)).orderBy(desc(tripDays.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: movieMetadata.locationId, ts: movieMetadata.updatedAt }).from(movieMetadata).where(isNotNull(movieMetadata.locationId)).orderBy(desc(movieMetadata.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: tvShowMetadata.locationId, ts: tvShowMetadata.updatedAt }).from(tvShowMetadata).where(isNotNull(tvShowMetadata.locationId)).orderBy(desc(tvShowMetadata.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: journalEntries.locationId, ts: journalEntries.updatedAt }).from(journalEntries).where(isNotNull(journalEntries.locationId)).orderBy(desc(journalEntries.updatedAt)).limit(SOURCE_SCAN_LIMIT),
  ]);
  return mergeRecent([mb, gal, td, mv, tv, je], RECENT_LIMIT);
}

async function deriveRecentTripIds(): Promise<string[]> {
  await ensureDbInitialized();
  const [mb, gal, mv, tv, je] = await Promise.all([
    db.select({ id: microblogs.tripId, ts: microblogs.updatedAt }).from(microblogs).where(isNotNull(microblogs.tripId)).orderBy(desc(microblogs.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: gallery.tripId, ts: gallery.updatedAt }).from(gallery).where(isNotNull(gallery.tripId)).orderBy(desc(gallery.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: movieMetadata.tripId, ts: movieMetadata.updatedAt }).from(movieMetadata).where(isNotNull(movieMetadata.tripId)).orderBy(desc(movieMetadata.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: tvShowMetadata.tripId, ts: tvShowMetadata.updatedAt }).from(tvShowMetadata).where(isNotNull(tvShowMetadata.tripId)).orderBy(desc(tvShowMetadata.updatedAt)).limit(SOURCE_SCAN_LIMIT),
    db.select({ id: journalEntries.tripId, ts: journalEntries.updatedAt }).from(journalEntries).where(isNotNull(journalEntries.tripId)).orderBy(desc(journalEntries.updatedAt)).limit(SOURCE_SCAN_LIMIT),
  ]);
  return mergeRecent([mb, gal, mv, tv, je], RECENT_LIMIT);
}

// ---------------------------------------------------------------------------
// Public picker data actions.
// ---------------------------------------------------------------------------

export async function getLocationPickerData(): Promise<LocationPickerData> {
  const cachedOptions = createCachedQuery(fetchLocationOptionsRaw, ["location-options"], {
    tags: ["locations-list"],
    revalidate: 3600,
  });
  const [options, recentIds] = await Promise.all([cachedOptions(), deriveRecentLocationIds()]);
  const valid = new Set(options.map((o) => o.id));
  return { options, recentIds: recentIds.filter((id) => valid.has(id)) };
}

export async function getTripPickerData(): Promise<TripPickerData> {
  const cachedOptions = createCachedQuery(fetchTripOptionsRaw, ["trip-options"], {
    tags: ["trips-list"],
    revalidate: 3600,
  });
  const [options, recentIds] = await Promise.all([cachedOptions(), deriveRecentTripIds()]);
  const valid = new Set(options.map((o) => o.id));
  return { options, recentIds: recentIds.filter((id) => valid.has(id)) };
}

/** Recent-id derivation only, for callers that already have their own option list. */
export async function getLocationRecentIds(validIds?: string[]): Promise<string[]> {
  const recent = await deriveRecentLocationIds();
  if (!validIds) return recent;
  const valid = new Set(validIds);
  return recent.filter((id) => valid.has(id));
}

export async function getTripRecentIds(validIds?: string[]): Promise<string[]> {
  const recent = await deriveRecentTripIds();
  if (!validIds) return recent;
  const valid = new Set(validIds);
  return recent.filter((id) => valid.has(id));
}

/** Location IDs associated with a specific trip via the relationships engine. */
export async function getTripLocationIds(tripId: string): Promise<string[]> {
  await ensureDbInitialized();
  const rels = await db
    .select({
      targetId: relationships.targetId,
      sourceId: relationships.sourceId,
      sourceType: relationships.sourceType,
    })
    .from(relationships)
    .where(
      or(
        and(eq(relationships.sourceType, "trip"), eq(relationships.sourceId, tripId), eq(relationships.targetType, "location")),
        and(eq(relationships.sourceType, "location"), eq(relationships.targetType, "trip"), eq(relationships.targetId, tripId))
      )
    );

  return rels.map((r) => (r.sourceType === "trip" ? r.targetId : r.sourceId));
}
