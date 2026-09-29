"use server";

import { db, ensureDbInitialized } from "@/db";
import { tripDays, trips, TripDayRecord, NewTripDay } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/features/activity/actions";
import { purgeTag } from "@/lib/server-cache";
import { enumerateDateRange, type TripDayUpdate } from "@/features/trips/day-helpers";

function genDayId(): string {
  return `tripday_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

async function purgeTripCaches(tripId: string): Promise<void> {
  purgeTag("trips-list");
  purgeTag(`trip-${tripId}`);
  const tr = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (tr[0]) {
    purgeTag(`trip-${tr[0].slug}`);
    try {
      revalidatePath(`/trips/${tr[0].slug}`);
    } catch {}
  }
}

export async function getTripDaysAction(tripId: string): Promise<TripDayRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.dayNumber), asc(tripDays.date));
}

/**
 * Create one empty day per date in [startDate, endDate] that doesn't already
 * have a row (matched by date). Idempotent: re-running only fills gaps.
 * New days are appended after the current highest dayNumber, then the whole
 * set is returned ordered.
 */
export async function generateTripDaysFromDatesAction(tripId: string): Promise<TripDayRecord[]> {
  await ensureDbInitialized();

  const trip = (await db.select().from(trips).where(eq(trips.id, tripId)).limit(1))[0];
  if (!trip) return [];

  const dates = enumerateDateRange(trip.startDate, trip.endDate);
  if (dates.length === 0) return getTripDaysAction(tripId);

  const existing = await db.select().from(tripDays).where(eq(tripDays.tripId, tripId));
  const existingDates = new Set(existing.map((d) => d.date).filter(Boolean));
  let nextNumber = existing.reduce((max, d) => Math.max(max, d.dayNumber), 0);

  const now = new Date().toISOString();
  const rows: NewTripDay[] = [];
  for (const date of dates) {
    if (existingDates.has(date)) continue;
    nextNumber += 1;
    rows.push({
      id: genDayId(),
      tripId,
      dayNumber: nextNumber,
      date,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (rows.length > 0) {
    await db.insert(tripDays).values(rows);
    await logActivity("trip_updated", "trip", tripId, `Generated ${rows.length} itinerary day(s) for: ${trip.title}`, { tripId });
    await purgeTripCaches(tripId);
  }

  return getTripDaysAction(tripId);
}

/** Append a single empty day (next dayNumber). */
export async function addTripDayAction(tripId: string, opts?: { date?: string }): Promise<TripDayRecord> {
  await ensureDbInitialized();

  const existing = await db.select().from(tripDays).where(eq(tripDays.tripId, tripId));
  const nextNumber = existing.reduce((max, d) => Math.max(max, d.dayNumber), 0) + 1;

  const now = new Date().toISOString();
  const row: NewTripDay = {
    id: genDayId(),
    tripId,
    dayNumber: nextNumber,
    date: opts?.date || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tripDays).values(row);
  await purgeTripCaches(tripId);
  return row as TripDayRecord;
}

export async function updateTripDayAction(
  dayId: string,
  payload: TripDayUpdate
): Promise<TripDayRecord | null> {
  await ensureDbInitialized();

  const existing = (await db.select().from(tripDays).where(eq(tripDays.id, dayId)).limit(1))[0];
  if (!existing) return null;

  const updates: Partial<NewTripDay> = { updatedAt: new Date().toISOString() };

  if (payload.date !== undefined) updates.date = payload.date || null;
  if (payload.title !== undefined) updates.title = payload.title || null;
  if (payload.primaryLocationId !== undefined) updates.primaryLocationId = payload.primaryLocationId || null;
  if (payload.primaryLocationName !== undefined) updates.primaryLocationName = payload.primaryLocationName || null;
  if (payload.weather !== undefined) updates.weather = payload.weather || null;
  if (payload.mood !== undefined) updates.mood = payload.mood ?? null;
  if (payload.notesMarkdown !== undefined) updates.notesMarkdown = payload.notesMarkdown || null;
  if (payload.transport !== undefined) updates.transportJson = JSON.stringify(payload.transport);
  if (payload.meals !== undefined) updates.mealsJson = JSON.stringify(payload.meals);
  if (payload.activities !== undefined) updates.activitiesJson = JSON.stringify(payload.activities);
  if (payload.accommodation !== undefined) updates.accommodationJson = JSON.stringify(payload.accommodation);
  if (payload.photos !== undefined) updates.photosJson = JSON.stringify(payload.photos);

  await db.update(tripDays).set(updates).where(eq(tripDays.id, dayId));
  await purgeTripCaches(existing.tripId);

  return { ...existing, ...updates } as TripDayRecord;
}

export async function deleteTripDayAction(dayId: string): Promise<boolean> {
  await ensureDbInitialized();
  const existing = (await db.select().from(tripDays).where(eq(tripDays.id, dayId)).limit(1))[0];
  if (!existing) return false;

  await db.delete(tripDays).where(eq(tripDays.id, dayId));
  await purgeTripCaches(existing.tripId);
  return true;
}
