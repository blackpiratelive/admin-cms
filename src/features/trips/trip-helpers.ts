import type { TripOverviewItem, TripFilterType, TripSortType } from "./types";

/**
 * Parse an ISO date string (YYYY-MM-DD) into a calendar date parts object
 * without timezone offset interference.
 */
export function parseCalendarDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format a calendar date string (YYYY-MM-DD) nicely, e.g. "Sep 22, 2026".
 */
export function formatCalendarDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const parts = parseCalendarDateParts(dateStr);
  if (!parts) return dateStr;
  const monthName = MONTH_NAMES[parts.month - 1];
  return `${monthName} ${parts.day}, ${parts.year}`;
}

/**
 * Format a date range cleanly.
 * e.g. "Sep 22 – Sep 29, 2026" or "Dec 28, 2025 – Jan 4, 2026"
 */
export function formatTripDateRange(startDate?: string | null, endDate?: string | null): string {
  if (!startDate && !endDate) return "Dates not set";
  if (startDate && !endDate) return `From ${formatCalendarDate(startDate)}`;
  if (!startDate && endDate) return `Until ${formatCalendarDate(endDate)}`;

  const sParts = parseCalendarDateParts(startDate!);
  const eParts = parseCalendarDateParts(endDate!);

  if (!sParts || !eParts) {
    return [startDate, endDate].filter(Boolean).join(" – ");
  }

  const sMonth = MONTH_NAMES[sParts.month - 1];
  const eMonth = MONTH_NAMES[eParts.month - 1];

  if (sParts.year === eParts.year) {
    if (sParts.month === eParts.month && sParts.day === eParts.day) {
      return `${sMonth} ${sParts.day}, ${sParts.year}`;
    }
    return `${sMonth} ${sParts.day} – ${eMonth} ${eParts.day}, ${sParts.year}`;
  }

  return `${sMonth} ${sParts.day}, ${sParts.year} – ${eMonth} ${eParts.day}, ${eParts.year}`;
}

/**
 * Calculate the calendar day duration of a trip (inclusive: end - start + 1).
 * Returns 1 for same-day trips, and 1 as fallback for invalid/negative ranges.
 */
export function computeTripDuration(startDate?: string | null, endDate?: string | null): number {
  if (!startDate || !endDate) return 1;
  const sParts = parseCalendarDateParts(startDate);
  const eParts = parseCalendarDateParts(endDate);
  if (!sParts || !eParts) return 1;

  const sUtc = Date.UTC(sParts.year, sParts.month - 1, sParts.day);
  const eUtc = Date.UTC(eParts.year, eParts.month - 1, eParts.day);

  if (eUtc < sUtc) return 1; // Graceful fallback: never negative

  const diffDays = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * Format title for display if it has city route patterns.
 * e.g. "Durgapur-Ranchi-Delhi" -> "Durgapur → Ranchi → Delhi"
 */
export function formatTripDisplayTitle(title: string): string {
  if (!title) return "";
  const trimmed = title.trim();

  // If already contains arrows, keep as is
  if (trimmed.includes("→") || trimmed.includes("->")) {
    return trimmed.replace(/->/g, " → ").replace(/\s+→\s+/g, " → ");
  }

  // If hyphen-separated capitalized words (e.g. City-City-City)
  if (/^[A-Z][a-zA-Z0-9\s]+(-[A-Z][a-zA-Z0-9\s]+)+$/.test(trimmed)) {
    return trimmed.split("-").map((s) => s.trim()).join(" → ");
  }

  return trimmed;
}

/**
 * Computes itinerary progress percentage safely between 0 and 100.
 */
export function computeItineraryProgress(plannedDays: number, totalDays: number): number {
  if (totalDays <= 0) return 0;
  const ratio = plannedDays / totalDays;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

/**
 * Deterministically pick a cover theme ('one' | 'two' | 'three' | 'four')
 * based on the trip's ID or slug hash.
 */
export function getDeterministicCoverTheme(idOrSlug: string): "one" | "two" | "three" | "four" {
  const themes: Array<"one" | "two" | "three" | "four"> = ["one", "two", "three", "four"];
  let hash = 0;
  for (let i = 0; i < (idOrSlug || "").length; i++) {
    hash = (hash * 31 + idOrSlug.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % themes.length;
  return themes[index];
}

/**
 * Check if a trip matches the active filter chip.
 * Deterministic mapping to domain status:
 * - 'all': all trips
 * - 'upcoming': planned status and not cancelled (or future start date)
 * - 'ongoing': ongoing status
 * - 'completed': completed status
 * - 'favorites': favorite === true
 */
export function isTripMatchingFilter(
  trip: TripOverviewItem,
  filter: TripFilterType,
  todayIso?: string
): boolean {
  if (filter === "all") return true;
  if (filter === "favorites") return trip.favorite;
  if (filter === "completed") return trip.status === "completed";
  if (filter === "ongoing") return trip.status === "ongoing";

  if (filter === "upcoming") {
    // Cancelled trips must never appear in upcoming
    if (trip.status === "cancelled") return false;
    if (trip.status === "planned") return true;

    // If dates are present and in the future
    if (todayIso && trip.startDate && trip.startDate > todayIso && trip.status !== "completed") {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Sort trips based on sort key.
 */
export function sortTripOverviewItems(
  items: TripOverviewItem[],
  sort: TripSortType
): TripOverviewItem[] {
  const cloned = [...items];
  cloned.sort((a, b) => {
    if (sort === "oldest") {
      const aDate = a.startDate || a.createdAt;
      const bDate = b.startDate || b.createdAt;
      return aDate.localeCompare(bDate);
    }
    if (sort === "duration") {
      if (b.duration !== a.duration) {
        return b.duration - a.duration;
      }
      return (b.startDate || b.createdAt).localeCompare(a.startDate || a.createdAt);
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    // "recent": newest start date or created date
    const aDate = a.startDate || a.createdAt;
    const bDate = b.startDate || b.createdAt;
    return bDate.localeCompare(aDate);
  });
  return cloned;
}

/**
 * Filter and sort a collection of trip overview items.
 */
export function filterAndSortTrips(
  items: TripOverviewItem[],
  query: string,
  filter: TripFilterType,
  sort: TripSortType,
  todayIso?: string
): TripOverviewItem[] {
  const cleanQ = query.trim().toLowerCase();

  const filtered = items.filter((trip) => {
    if (!isTripMatchingFilter(trip, filter, todayIso)) return false;

    if (!cleanQ) return true;

    const searchable = [
      trip.title,
      trip.displayTitle,
      trip.description || "",
      ...trip.locationNames,
      ...trip.tags,
      trip.status,
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(cleanQ);
  });

  return sortTripOverviewItems(filtered, sort);
}

/**
 * Select the featured trip based on the deterministic rules:
 * 1. favorite + completed trip if available
 * 2. otherwise most recently active / recently updated trip
 * 3. otherwise newest trip
 * 4. otherwise null
 */
export function selectFeaturedTrip(items: TripOverviewItem[]): TripOverviewItem | null {
  if (items.length === 0) return null;

  // 1. Favorite + completed
  const favCompleted = items.find((t) => t.favorite && t.status === "completed");
  if (favCompleted) return favCompleted;

  // 2. Any favorite
  const anyFav = items.find((t) => t.favorite);
  if (anyFav) return anyFav;

  // 3. Most recently updated / newest start date
  const sorted = [...items].sort((a, b) => {
    const aVal = a.updatedAt || a.startDate || a.createdAt;
    const bVal = b.updatedAt || b.startDate || b.createdAt;
    return bVal.localeCompare(aVal);
  });

  return sorted[0] || null;
}
