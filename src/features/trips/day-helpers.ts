import type { TripDayRecord } from "@/db/schema";

// ---------------------------------------------------------------------------
// Structured entry shapes stored inside the JSON columns of `trip_days`.
// Kept intentionally flat/optional so the day editor can add rows freely.
// This module holds pure types + helpers only (no "use server"), so it can be
// imported by client components and unit-tested without a DB.
// ---------------------------------------------------------------------------
export type TransportMode =
  | "walk" | "bike" | "bus" | "train" | "flight" | "car" | "taxi" | "boat" | "other";

export const TRANSPORT_MODES: TransportMode[] = [
  "walk", "bike", "bus", "train", "flight", "car", "taxi", "boat", "other",
];

export interface TransportWaypoint {
  id: string;
  locationId?: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface TransportLeg {
  id: string;
  mode: TransportMode;
  fromLocationId?: string;
  fromName?: string;
  fromLat?: number | null;
  fromLng?: number | null;
  toLocationId?: string;
  toName?: string;
  toLat?: number | null;
  toLng?: number | null;
  waypoints?: TransportWaypoint[];
  departTime?: string;
  arriveTime?: string;
  cost?: number;
  currency?: string;
  /**
   * Manual distance override for this leg, in kilometers. When set (> 0) it wins
   * over the coordinate-derived estimate. Left undefined, the leg distance is
   * estimated from the from → waypoints → to coordinates (see computeLegDistanceKm).
   */
  distanceKm?: number;
  notes?: string;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drinks";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "drinks"];

export interface MealEntry {
  id: string;
  type: MealType;
  place?: string;
  placeLocationId?: string;
  lat?: number | null;
  lng?: number | null;
  dishes?: string;
  cost?: number;
  currency?: string;
  rating?: number;
  notes?: string;
}

export interface ActivityEntry {
  id: string;
  title: string;
  time?: string;
  locationId?: string;
  locationName?: string;
  lat?: number | null;
  lng?: number | null;
  cost?: number;
  currency?: string;
  notes?: string;
}

export interface Accommodation {
  name?: string;
  locationId?: string;
  locationName?: string;
  lat?: number | null;
  lng?: number | null;
  cost?: number;
  currency?: string;
  notes?: string;
}

export interface DayPhoto {
  id: string;
  url: string;
  caption?: string;
}

/** Structured lists as objects (rather than JSON), accepted by updateTripDayAction. */
export interface TripDayUpdate {
  date?: string | null;
  title?: string | null;
  primaryLocationId?: string | null;
  primaryLocationName?: string | null;
  primaryLocationLat?: number | null;
  primaryLocationLng?: number | null;
  transport?: TransportLeg[];
  meals?: MealEntry[];
  activities?: ActivityEntry[];
  accommodation?: Accommodation;
  photos?: DayPhoto[];
  weather?: string | null;
  mood?: number | null;
  notesMarkdown?: string | null;
}

/** A day with its JSON columns already parsed into structured objects. */
export interface ParsedTripDay extends TripDayRecord {
  transport: TransportLeg[];
  meals: MealEntry[];
  activities: ActivityEntry[];
  accommodation: Accommodation;
  photos: DayPhoto[];
}

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Parse a raw DB row's JSON columns into structured arrays/objects. */
export function parseTripDay(day: TripDayRecord): ParsedTripDay {
  return {
    ...day,
    transport: safeParse<TransportLeg[]>(day.transportJson, []),
    meals: safeParse<MealEntry[]>(day.mealsJson, []),
    activities: safeParse<ActivityEntry[]>(day.activitiesJson, []),
    accommodation: safeParse<Accommodation>(day.accommodationJson, {}),
    photos: safeParse<DayPhoto[]>(day.photosJson, []),
  };
}

/** Missing/blank currency is grouped under this key; formatter shows the bare amount. */
const NO_CURRENCY = "";

type CostTotals = Record<string, number>;

function addCost(totals: CostTotals, cost?: number, currency?: string): void {
  if (typeof cost !== "number" || Number.isNaN(cost) || cost === 0) return;
  const key = (currency || "").trim() || NO_CURRENCY;
  totals[key] = (totals[key] || 0) + cost;
}

/** Sum every cost-bearing entry on a single day, grouped by currency. */
export function computeDayCost(day: TripDayRecord): CostTotals {
  const parsed = parseTripDay(day);
  const totals: CostTotals = {};
  for (const leg of parsed.transport) addCost(totals, leg.cost, leg.currency);
  for (const meal of parsed.meals) addCost(totals, meal.cost, meal.currency);
  for (const act of parsed.activities) addCost(totals, act.cost, act.currency);
  addCost(totals, parsed.accommodation.cost, parsed.accommodation.currency);
  return totals;
}

export interface TripCostSummary {
  /** Per-day totals keyed by day id, each grouped by currency. */
  perDay: Record<string, CostTotals>;
  /** Trip-wide totals grouped by currency. */
  total: CostTotals;
  dayCount: number;
}

/** Roll up per-day and trip-wide spend, grouped by currency. */
export function computeTripCostSummary(days: TripDayRecord[]): TripCostSummary {
  const perDay: Record<string, CostTotals> = {};
  const total: CostTotals = {};

  for (const day of days) {
    const dayTotals = computeDayCost(day);
    perDay[day.id] = dayTotals;
    for (const [cur, amount] of Object.entries(dayTotals)) {
      total[cur] = (total[cur] || 0) + amount;
    }
  }

  return { perDay, total, dayCount: days.length };
}

/** Format grouped totals for display, e.g. "₹4,500 + $30". Empty when no spend. */
export function formatCostTotals(totals: CostTotals): string {
  const parts = Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .map(([cur, amount]) => {
      const num = amount.toLocaleString();
      return cur ? `${cur} ${num}` : num;
    });
  return parts.join(" + ");
}

// ---------------------------------------------------------------------------
// Distance travelled (kilometers)
//
// Two complementary notions, mirroring the cost roll-up above:
//   • "Logged travel"  — per-leg / per-day distance from logged transport legs,
//     honoring a manual `distanceKm` override, else estimated as the straight
//     great-circle hop(s) through the leg's own coordinates.
//   • "Route distance" — the geometric length of the full chronological route
//     the map draws, summed over consecutive stop coordinates.
// Both are read-time derivations (no new DB columns): leg coordinates already
// live inside `transportJson`, and the manual override rides in the same JSON.
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle (haversine) distance in km between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Coord {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

function isValidCoord(c: Coord): c is { latitude: number; longitude: number } {
  return (
    typeof c.latitude === "number" &&
    typeof c.longitude === "number" &&
    !Number.isNaN(c.latitude) &&
    !Number.isNaN(c.longitude)
  );
}

/** True when the leg carries a usable manual distance override. */
export function isLegDistanceManual(leg: TransportLeg): boolean {
  return typeof leg.distanceKm === "number" && !Number.isNaN(leg.distanceKm) && leg.distanceKm > 0;
}

/**
 * Distance of a single transport leg in km, or null when it can't be determined.
 * Manual `distanceKm` wins; otherwise sum the great-circle hops through
 * from → waypoints → to using whatever coordinates are present.
 */
export function computeLegDistanceKm(leg: TransportLeg): number | null {
  if (isLegDistanceManual(leg)) return leg.distanceKm as number;

  const points: Coord[] = [
    { latitude: leg.fromLat, longitude: leg.fromLng },
    ...(leg.waypoints || []).map((wp) => ({ latitude: wp.latitude, longitude: wp.longitude })),
    { latitude: leg.toLat, longitude: leg.toLng },
  ].filter(isValidCoord);

  if (points.length < 2) return null;

  let km = 0;
  for (let i = 1; i < points.length; i++) {
    km += haversineKm(
      points[i - 1].latitude as number,
      points[i - 1].longitude as number,
      points[i].latitude as number,
      points[i].longitude as number
    );
  }
  return km;
}

/** Sum of logged transport-leg distances on a single day (km). */
export function computeDayDistanceKm(day: TripDayRecord): number {
  const parsed = parseTripDay(day);
  let km = 0;
  for (const leg of parsed.transport) {
    km += computeLegDistanceKm(leg) ?? 0;
  }
  return km;
}

export interface TripDistanceSummary {
  /** Per-day logged-travel distance keyed by day id (km). */
  perDay: Record<string, number>;
  /** Trip-wide logged-travel distance (km). */
  total: number;
  /** True when at least one contributing leg was estimated from coordinates. */
  estimated: boolean;
}

/** Roll up per-day and trip-wide logged-travel distance. */
export function computeTripDistanceSummary(days: TripDayRecord[]): TripDistanceSummary {
  const perDay: Record<string, number> = {};
  let total = 0;
  let estimated = false;

  for (const day of days) {
    const parsed = parseTripDay(day);
    let dayKm = 0;
    for (const leg of parsed.transport) {
      const legKm = computeLegDistanceKm(leg);
      if (legKm == null) continue;
      dayKm += legKm;
      if (!isLegDistanceManual(leg)) estimated = true;
    }
    perDay[day.id] = dayKm;
    total += dayKm;
  }

  return { perDay, total, estimated };
}

/**
 * Build the ordered list of coordinate stops the trip route passes through,
 * in chronological day order, mirroring getTripMapLocationsAction's sequence:
 * primary → (per leg: from, waypoints, to) → activities → meals → accommodation.
 * Coordinates come from the day JSON first, falling back to `resolve(locationId)`.
 * Consecutive identical coordinates are collapsed so there are no zero hops.
 */
export function buildDayRouteStops(
  days: TripDayRecord[],
  resolve?: (locationId: string) => { latitude: number | null; longitude: number | null } | undefined
): Array<{ latitude: number; longitude: number }> {
  const ordered = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const stops: Array<{ latitude: number; longitude: number }> = [];

  const push = (lat: number | null | undefined, lng: number | null | undefined, locId?: string | null) => {
    let latitude = lat;
    let longitude = lng;
    if ((latitude == null || longitude == null) && locId && resolve) {
      const r = resolve(locId);
      if (r) {
        latitude = r.latitude;
        longitude = r.longitude;
      }
    }
    if (!isValidCoord({ latitude, longitude })) return;
    const prev = stops[stops.length - 1];
    if (prev && prev.latitude === latitude && prev.longitude === longitude) return;
    stops.push({ latitude: latitude as number, longitude: longitude as number });
  };

  for (const day of ordered) {
    const parsed = parseTripDay(day);
    push(day.primaryLocationLat, day.primaryLocationLng, day.primaryLocationId);
    for (const leg of parsed.transport) {
      push(leg.fromLat, leg.fromLng, leg.fromLocationId);
      for (const wp of leg.waypoints || []) push(wp.latitude, wp.longitude, wp.locationId);
      push(leg.toLat, leg.toLng, leg.toLocationId);
    }
    for (const act of parsed.activities) push(act.lat, act.lng, act.locationId);
    for (const meal of parsed.meals) push(meal.lat, meal.lng, meal.placeLocationId);
    push(parsed.accommodation.lat, parsed.accommodation.lng, parsed.accommodation.locationId);
  }

  return stops;
}

/** Sum the great-circle length (km) of a chronological list of coordinate stops. */
export function sumRouteDistanceKm(
  stops: Array<{ latitude: number | null; longitude: number | null }>
): number {
  const valid = stops.filter(isValidCoord);
  let km = 0;
  for (let i = 1; i < valid.length; i++) {
    km += haversineKm(
      valid[i - 1].latitude,
      valid[i - 1].longitude,
      valid[i].latitude,
      valid[i].longitude
    );
  }
  return km;
}

/**
 * Format a distance in km for display, e.g. "≈ 1,240 km" or "4.2 km".
 * Returns "" for a zero / absent distance. Values under 10 km keep one decimal.
 */
export function formatDistanceKm(km: number, opts?: { approx?: boolean }): string {
  if (typeof km !== "number" || Number.isNaN(km) || km <= 0) return "";
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  const num = rounded.toLocaleString();
  return `${opts?.approx ? "≈ " : ""}${num} km`;
}

/**
 * Enumerate every ISO date (YYYY-MM-DD) from start to end inclusive.
 * Returns [] when either bound is missing or the range is invalid/absurd.
 */
export function enumerateDateRange(start?: string | null, end?: string | null): string[] {
  if (!start || !end) return [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return [];

  const dates: string[] = [];
  const DAY = 86_400_000;
  // Cap at ~2 years to guard against a typo producing millions of rows.
  for (let ms = startMs; ms <= endMs && dates.length < 750; ms += DAY) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}
