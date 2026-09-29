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

export interface TransportLeg {
  id: string;
  mode: TransportMode;
  fromLocationId?: string;
  fromName?: string;
  toLocationId?: string;
  toName?: string;
  departTime?: string;
  arriveTime?: string;
  cost?: number;
  currency?: string;
  notes?: string;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drinks";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "drinks"];

export interface MealEntry {
  id: string;
  type: MealType;
  place?: string;
  placeLocationId?: string;
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
  cost?: number;
  currency?: string;
  notes?: string;
}

export interface Accommodation {
  name?: string;
  locationId?: string;
  locationName?: string;
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
