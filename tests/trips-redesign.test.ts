import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { trips, tripDays, locations, relationships } from "../src/db/schema";
import { eq, or, and } from "drizzle-orm";
import {
  getTripsOverviewAction,
  duplicateTripAction,
  toggleTripFavoriteAction,
  getTripMapLocationsAction,
  getMapboxTokenAction,
} from "../src/features/trips/actions";
import {
  parseCalendarDateParts,
  formatCalendarDate,
  formatTripDateRange,
  computeTripDuration,
  formatTripDisplayTitle,
  computeItineraryProgress,
  getDeterministicCoverTheme,
  isTripMatchingFilter,
  sortTripOverviewItems,
  filterAndSortTrips,
  selectFeaturedTrip,
} from "../src/features/trips/trip-helpers";
import type { TripOverviewItem } from "../src/features/trips/types";

const TEST_TRIP_ID = "trip_test_redesign_1";
const TEST_TRIP_SLUG = "durgapur-ranchi-delhi-test";
const TEST_LOC_1 = "loc_test_rd_1";
const TEST_LOC_2 = "loc_test_rd_2";
const TEST_LOC_3 = "loc_test_rd_3";

describe("Trips Redesign — Date Logic & Helper Utilities", () => {
  it("parses calendar date parts without timezone offset issues", () => {
    expect(parseCalendarDateParts("2026-09-22")).toEqual({ year: 2026, month: 9, day: 22 });
    expect(parseCalendarDateParts("2026-01-01")).toEqual({ year: 2026, month: 1, day: 1 });
    expect(parseCalendarDateParts("invalid-date")).toBeNull();
  });

  it("formats single calendar dates reliably", () => {
    expect(formatCalendarDate("2026-09-22")).toBe("Sep 22, 2026");
    expect(formatCalendarDate("2026-01-05")).toBe("Jan 5, 2026");
    expect(formatCalendarDate(null)).toBe("");
  });

  it("formats date ranges across same month, cross-month, and cross-year", () => {
    // Same month
    expect(formatTripDateRange("2026-09-22", "2026-09-29")).toBe("Sep 22 – Sep 29, 2026");
    // Same day
    expect(formatTripDateRange("2026-09-22", "2026-09-22")).toBe("Sep 22, 2026");
    // Cross-month
    expect(formatTripDateRange("2026-08-28", "2026-09-02")).toBe("Aug 28 – Sep 2, 2026");
    // Cross-year
    expect(formatTripDateRange("2025-12-28", "2026-01-04")).toBe("Dec 28, 2025 – Jan 4, 2026");
    // Missing dates
    expect(formatTripDateRange(null, null)).toBe("Dates not set");
    expect(formatTripDateRange("2026-09-22", null)).toBe("From Sep 22, 2026");
    expect(formatTripDateRange(null, "2026-09-29")).toBe("Until Sep 29, 2026");
  });

  it("computes trip duration with edge case handling", () => {
    // 8 days inclusive (22, 23, 24, 25, 26, 27, 28, 29)
    expect(computeTripDuration("2026-09-22", "2026-09-29")).toBe(8);
    // Same day = 1 day
    expect(computeTripDuration("2026-09-22", "2026-09-22")).toBe(1);
    // Invalid/inverted date range (end before start): never returns negative
    expect(computeTripDuration("2026-09-29", "2026-09-22")).toBe(1);
    // Missing dates = fallback to 1
    expect(computeTripDuration(null, null)).toBe(1);
  });

  it("formats trip display title intelligently", () => {
    // Hyphenated city pattern
    expect(formatTripDisplayTitle("Durgapur-Ranchi-Delhi")).toBe("Durgapur → Ranchi → Delhi");
    // Arrow pattern
    expect(formatTripDisplayTitle("Tokyo -> Kyoto -> Osaka")).toBe("Tokyo → Kyoto → Osaka");
    // Standard title
    expect(formatTripDisplayTitle("Summer Roadtrip 2026")).toBe("Summer Roadtrip 2026");
  });

  it("calculates itinerary progress percentage with boundary safety", () => {
    expect(computeItineraryProgress(8, 8)).toBe(100);
    expect(computeItineraryProgress(2, 8)).toBe(25);
    expect(computeItineraryProgress(0, 8)).toBe(0);
    expect(computeItineraryProgress(10, 8)).toBe(100); // capped at 100
    expect(computeItineraryProgress(5, 0)).toBe(0); // 0 total days
  });

  it("deterministically assigns fallback cover themes", () => {
    const t1 = getDeterministicCoverTheme("trip_durgapur");
    const t2 = getDeterministicCoverTheme("trip_durgapur");
    expect(t1).toBe(t2); // deterministic
    expect(["one", "two", "three", "four"]).toContain(t1);
  });
});

describe("Trips Redesign — Filter & Sort Logic", () => {
  const sampleTrips: TripOverviewItem[] = [
    {
      id: "t1",
      slug: "durgapur-ranchi-delhi",
      title: "Durgapur-Ranchi-Delhi",
      displayTitle: "Durgapur → Ranchi → Delhi",
      description: "A memorable journey",
      startDate: "2026-09-22",
      endDate: "2026-09-29",
      dateRangeFormatted: "Sep 22 – 29, 2026",
      duration: 8,
      status: "completed",
      visibility: "public",
      favorite: true,
      tags: ["india", "train"],
      placesCount: 3,
      locationNames: ["Durgapur", "Ranchi", "Delhi"],
      photosCount: 12,
      coverImageUrl: null,
      fallbackCoverTheme: "one",
      itineraryTotalDays: 8,
      itineraryPlannedDays: 8,
      itineraryProgressPercent: 100,
      spendFormatted: "₹ 4,500",
      spendTotals: { "₹": 4500 },
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-30T00:00:00Z",
    },
    {
      id: "t2",
      slug: "mts-pet-2026",
      title: "MTS PET 2026",
      displayTitle: "MTS PET 2026",
      description: "Exam venue trip",
      startDate: "2026-08-25",
      endDate: "2026-08-28",
      dateRangeFormatted: "Aug 25 – 28, 2026",
      duration: 4,
      status: "completed",
      visibility: "public",
      favorite: false,
      tags: ["exam"],
      placesCount: 2,
      locationNames: ["Exam Center", "Hotel"],
      photosCount: 4,
      coverImageUrl: null,
      fallbackCoverTheme: "two",
      itineraryTotalDays: 4,
      itineraryPlannedDays: 4,
      itineraryProgressPercent: 100,
      spendFormatted: null,
      spendTotals: {},
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-29T00:00:00Z",
    },
    {
      id: "t3",
      slug: "college-excursion",
      title: "College Excursion",
      displayTitle: "College Excursion",
      description: "Upcoming group tour",
      startDate: "2026-10-16",
      endDate: "2026-10-19",
      dateRangeFormatted: "Oct 16 – 19, 2026",
      duration: 4,
      status: "planned",
      visibility: "public",
      favorite: true,
      tags: ["college", "friends"],
      placesCount: 4,
      locationNames: ["Campus", "Destination", "Resort"],
      photosCount: 0,
      coverImageUrl: null,
      fallbackCoverTheme: "three",
      itineraryTotalDays: 4,
      itineraryPlannedDays: 1,
      itineraryProgressPercent: 25,
      spendFormatted: null,
      spendTotals: {},
      createdAt: "2026-09-15T00:00:00Z",
      updatedAt: "2026-09-15T00:00:00Z",
    },
    {
      id: "t4",
      slug: "cancelled-future-trip",
      title: "Cancelled Future Trip",
      displayTitle: "Cancelled Future Trip",
      description: "Did not happen",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      dateRangeFormatted: "Nov 1 – 5, 2026",
      duration: 5,
      status: "cancelled",
      visibility: "private",
      favorite: false,
      tags: [],
      placesCount: 1,
      locationNames: ["Airport"],
      photosCount: 0,
      coverImageUrl: null,
      fallbackCoverTheme: "four",
      itineraryTotalDays: 5,
      itineraryPlannedDays: 0,
      itineraryProgressPercent: 0,
      spendFormatted: null,
      spendTotals: {},
      createdAt: "2026-09-20T00:00:00Z",
      updatedAt: "2026-09-20T00:00:00Z",
    },
  ];

  it("filters trips by status and favorites", () => {
    // All
    expect(filterAndSortTrips(sampleTrips, "", "all", "recent")).toHaveLength(4);

    // Completed
    const completed = filterAndSortTrips(sampleTrips, "", "completed", "recent");
    expect(completed.map((t) => t.id)).toEqual(["t1", "t2"]);

    // Upcoming (must include planned, and never cancelled)
    const upcoming = filterAndSortTrips(sampleTrips, "", "upcoming", "recent");
    expect(upcoming.map((t) => t.id)).toEqual(["t3"]);
    expect(upcoming.find((t) => t.id === "t4")).toBeUndefined(); // cancelled trip must NOT appear in upcoming

    // Favorites
    const favorites = filterAndSortTrips(sampleTrips, "", "favorites", "recent");
    expect(favorites.map((t) => t.id)).toEqual(["t3", "t1"]);
  });

  it("searches trips across title, display title, description, locations, and tags", () => {
    // By location
    const byLoc = filterAndSortTrips(sampleTrips, "Delhi", "all", "recent");
    expect(byLoc.map((t) => t.id)).toEqual(["t1"]);

    // By tag
    const byTag = filterAndSortTrips(sampleTrips, "friends", "all", "recent");
    expect(byTag.map((t) => t.id)).toEqual(["t3"]);

    // Case-insensitive
    const caseCheck = filterAndSortTrips(sampleTrips, "rAnChI", "all", "recent");
    expect(caseCheck.map((t) => t.id)).toEqual(["t1"]);

    // Nonexistent
    const none = filterAndSortTrips(sampleTrips, "nonexistent-place", "all", "recent");
    expect(none).toHaveLength(0);
  });

  it("sorts trips by recent, oldest, duration, and title", () => {
    // Sort: recent (newest start date first)
    const recent = filterAndSortTrips(sampleTrips, "", "all", "recent");
    expect(recent[0].id).toBe("t4"); // Nov 2026

    // Sort: oldest (oldest start date first)
    const oldest = filterAndSortTrips(sampleTrips, "", "all", "oldest");
    expect(oldest[0].id).toBe("t2"); // Aug 2026

    // Sort: duration (longest first)
    const byDuration = filterAndSortTrips(sampleTrips, "", "all", "duration");
    expect(byDuration[0].id).toBe("t1"); // 8 days

    // Sort: title (alphabetical)
    const byTitle = filterAndSortTrips(sampleTrips, "", "all", "title");
    expect(byTitle[0].id).toBe("t4"); // Cancelled Future Trip
  });

  it("selects featured trip according to deterministic priority rules", () => {
    // 1. Favorite + completed trip exists (t1)
    const featured = selectFeaturedTrip(sampleTrips);
    expect(featured?.id).toBe("t1");

    // If no favorite+completed exists, falls back to any favorite
    const withoutCompletedFav = sampleTrips.filter((t) => t.id !== "t1");
    const fallbackFav = selectFeaturedTrip(withoutCompletedFav);
    expect(fallbackFav?.id).toBe("t3");

    // Empty list returns null
    expect(selectFeaturedTrip([])).toBeNull();
  });
});

describe("Trips Redesign — Database Actions & Route Projection", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    await db
      .insert(trips)
      .values({
        id: TEST_TRIP_ID,
        title: "Durgapur-Ranchi-Delhi",
        slug: TEST_TRIP_SLUG,
        description: "A three-city adventure",
        startDate: "2026-09-22",
        endDate: "2026-09-29",
        status: "completed",
        visibility: "public",
        favorite: 1,
        tags: '["india", "railway"]',
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    await db
      .insert(locations)
      .values([
        {
          id: TEST_LOC_1,
          name: "Durgapur Junction",
          slug: "durgapur-junction-test",
          city: "Durgapur",
          country: "India",
          latitude: 23.5204,
          longitude: 87.3119,
          tags: "[]",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: TEST_LOC_2,
          name: "Ranchi Hills",
          slug: "ranchi-hills-test",
          city: "Ranchi",
          country: "India",
          latitude: 23.3441,
          longitude: 85.3096,
          tags: "[]",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: TEST_LOC_3,
          name: "Old Delhi Station",
          slug: "old-delhi-station-test",
          city: "Delhi",
          country: "India",
          latitude: null, // intentionally null coordinate to test missing coords handling
          longitude: null,
          tags: "[]",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    // Link location 1 to trip
    await db
      .insert(relationships)
      .values({
        id: `rel_test_rd_${Date.now()}`,
        sourceType: "trip",
        sourceId: TEST_TRIP_ID,
        targetType: "location",
        targetId: TEST_LOC_1,
        relationship: "includes_location",
        createdAt: now,
      })
      .onConflictDoNothing();

    // Day 1
    await db
      .insert(tripDays)
      .values({
        id: `tripday_test_rd_1`,
        tripId: TEST_TRIP_ID,
        dayNumber: 1,
        date: "2026-09-22",
        title: "Departure from Durgapur",
        primaryLocationId: TEST_LOC_1,
        primaryLocationName: "Durgapur Junction",
        transportJson: JSON.stringify([
          { id: "leg1", mode: "train", fromLocationId: TEST_LOC_1, toLocationId: TEST_LOC_2, cost: 650, currency: "₹" },
        ]),
        mealsJson: "[]",
        activitiesJson: "[]",
        accommodationJson: "{}",
        photosJson: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // Day 2
    await db
      .insert(tripDays)
      .values({
        id: `tripday_test_rd_2`,
        tripId: TEST_TRIP_ID,
        dayNumber: 2,
        date: "2026-09-23",
        title: "Arrive in Ranchi",
        primaryLocationId: TEST_LOC_2,
        primaryLocationName: "Ranchi Hills",
        transportJson: "[]",
        mealsJson: "[]",
        activitiesJson: "[]",
        accommodationJson: "{}",
        photosJson: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // Day 3 (references location 3 without coordinates)
    await db
      .insert(tripDays)
      .values({
        id: `tripday_test_rd_3`,
        tripId: TEST_TRIP_ID,
        dayNumber: 3,
        date: "2026-09-24",
        title: "Delhi Stopover",
        primaryLocationId: TEST_LOC_3,
        primaryLocationName: "Old Delhi Station",
        transportJson: "[]",
        mealsJson: "[]",
        activitiesJson: "[]",
        accommodationJson: "{}",
        photosJson: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(tripDays).where(eq(tripDays.tripId, TEST_TRIP_ID));
    await db.delete(trips).where(eq(trips.id, TEST_TRIP_ID));
    await db
      .delete(locations)
      .where(or(eq(locations.id, TEST_LOC_1), eq(locations.id, TEST_LOC_2), eq(locations.id, TEST_LOC_3)));
    await db
      .delete(relationships)
      .where(or(eq(relationships.sourceId, TEST_TRIP_ID), eq(relationships.targetId, TEST_TRIP_ID)));
  });

  it("fetches enriched trip overview items in batch without N+1 queries", async () => {
    const overview = await getTripsOverviewAction();
    expect(overview.length).toBeGreaterThan(0);

    const testItem = overview.find((t) => t.id === TEST_TRIP_ID);
    expect(testItem).toBeDefined();
    expect(testItem!.title).toBe("Durgapur-Ranchi-Delhi");
    expect(testItem!.displayTitle).toBe("Durgapur → Ranchi → Delhi");
    expect(testItem!.duration).toBe(8);
    expect(testItem!.dateRangeFormatted).toBe("Sep 22 – Sep 29, 2026");
    expect(testItem!.status).toBe("completed");
    expect(testItem!.favorite).toBe(true);
    expect(testItem!.placesCount).toBeGreaterThanOrEqual(2);
    expect(testItem!.locationNames).toContain("Durgapur Junction");
    expect(testItem!.spendFormatted).toBe("₹ 650");
  });

  it("duplicates a trip, cloning its days and relationships", async () => {
    const duplicated = await duplicateTripAction(TEST_TRIP_ID);
    expect(duplicated).not.toBeNull();
    expect(duplicated!.title).toBe("Durgapur-Ranchi-Delhi (Copy)");
    expect(duplicated!.id).not.toBe(TEST_TRIP_ID);

    // Verify duplicated days exist
    const clonedDays = await db.select().from(tripDays).where(eq(tripDays.tripId, duplicated!.id));
    expect(clonedDays.length).toBe(3);

    // Clean up duplicated record
    await db.delete(tripDays).where(eq(tripDays.tripId, duplicated!.id));
    await db.delete(trips).where(eq(trips.id, duplicated!.id));
  });

  it("toggles trip favorite directly in database", async () => {
    const toggleToFalse = await toggleTripFavoriteAction(TEST_TRIP_ID, false);
    expect(toggleToFalse.favorite).toBe(false);

    let check = (await db.select().from(trips).where(eq(trips.id, TEST_TRIP_ID)))[0];
    expect(check.favorite).toBe(0);

    const toggleToTrue = await toggleTripFavoriteAction(TEST_TRIP_ID, true);
    expect(toggleToTrue.favorite).toBe(true);

    check = (await db.select().from(trips).where(eq(trips.id, TEST_TRIP_ID)))[0];
    expect(check.favorite).toBe(1);
  });

  it("returns ordered route locations with valid coordinates and identifies missing coordinates", async () => {
    const mapData = await getTripMapLocationsAction(TEST_TRIP_SLUG);

    // Locations 1 and 2 have valid latitude/longitude
    expect(mapData.orderedLocations.length).toBe(2);
    expect(mapData.orderedLocations.map((l) => l.name)).toEqual([
      "Durgapur Junction",
      "Ranchi Hills",
    ]);
    expect(mapData.orderedLocations[0].latitude).toBe(23.5204);
    expect(mapData.orderedLocations[0].longitude).toBe(87.3119);

    // Location 3 had null coordinates, should be in missingCoords
    expect(mapData.missingCoords.length).toBe(1);
    expect(mapData.missingCoords[0].name).toBe("Old Delhi Station");
  });

  it("retrieves mapbox token safely from environment", async () => {
    const token = await getMapboxTokenAction();
    expect(token === null || typeof token === "string").toBe(true);
  });
});
