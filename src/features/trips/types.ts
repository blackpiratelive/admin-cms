import type { TripRecord } from "@/db/schema";
import type { TransportMode } from "@/features/trips/day-helpers";

export type TripFilterType = "all" | "upcoming" | "ongoing" | "completed" | "favorites";
export type TripSortType = "recent" | "oldest" | "duration" | "title";
export type TripViewMode = "grid" | "list";

export interface TripOverviewItem {
  id: string;
  slug: string;
  title: string;
  displayTitle: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  dateRangeFormatted: string;
  duration: number;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  visibility: "public" | "private" | "unlisted";
  favorite: boolean;
  tags: string[];
  placesCount: number;
  locationNames: string[];
  photosCount: number;
  coverImageUrl: string | null;
  fallbackCoverTheme: "one" | "two" | "three" | "four";
  itineraryTotalDays: number;
  itineraryPlannedDays: number;
  itineraryProgressPercent: number;
  spendFormatted: string | null;
  spendTotals: Record<string, number>;
  /** Geometric route distance in km (great-circle sum over itinerary stops). */
  distanceKm: number;
  /** Pre-formatted route distance, e.g. "≈ 1,240 km", or null when zero. */
  distanceFormatted: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripLocationCoordinate {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude: number | null;
  longitude: number | null;
  order: number;
  isPrimary?: boolean;
  dayNumber?: number | null;
  stopType?:
    | "primary"
    | "transport_from"
    | "transport_to"
    | "transport_waypoint"
    | "meal"
    | "activity"
    | "accommodation"
    | "associated";
  isAssociatedLocation?: boolean;
  transportMode?: TransportMode;
}
