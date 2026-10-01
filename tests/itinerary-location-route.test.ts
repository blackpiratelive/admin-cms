import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { trips, tripDays, locations, relationships } from "../src/db/schema";
import { eq, or } from "drizzle-orm";
import { addTripDayAction, updateTripDayAction } from "../src/features/trips/day-actions";
import { parseTripDay } from "../src/features/trips/day-helpers";
import { getTripMapLocationsAction } from "../src/features/trips/actions";

const TEST_TRIP_ID = "trip_test_route_map";
const TEST_TRIP_SLUG = "route-map-test-trip";
const TEST_ASSOC_LOC_ID = "loc_test_assoc_1";
const TEST_ENTITY_LOC_ID = "loc_test_entity_2";

describe("Itinerary Custom Coordinates & Map Route Sequencing", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    // Clean up any stale data
    await db.delete(tripDays).where(eq(tripDays.tripId, TEST_TRIP_ID));
    await db.delete(trips).where(eq(trips.id, TEST_TRIP_ID));
    await db
      .delete(locations)
      .where(or(eq(locations.id, TEST_ASSOC_LOC_ID), eq(locations.id, TEST_ENTITY_LOC_ID)));
    await db
      .delete(relationships)
      .where(or(eq(relationships.sourceId, TEST_TRIP_ID), eq(relationships.targetId, TEST_TRIP_ID)));

    // Create test trip
    await db.insert(trips).values({
      id: TEST_TRIP_ID,
      title: "Paris to Amsterdam Route",
      slug: TEST_TRIP_SLUG,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      status: "planned",
      visibility: "public",
      favorite: 0,
      tags: "[]",
      createdAt: now,
      updatedAt: now,
    });

    // Create associated location entity (linked via relationship)
    await db.insert(locations).values([
      {
        id: TEST_ASSOC_LOC_ID,
        name: "Grand Hotel Paris",
        slug: "grand-hotel-paris",
        city: "Paris",
        country: "France",
        latitude: 48.8708,
        longitude: 2.3315,
        visibility: "public",
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: TEST_ENTITY_LOC_ID,
        name: "Amsterdam Centraal Station",
        slug: "amsterdam-centraal-station",
        city: "Amsterdam",
        country: "Netherlands",
        latitude: 52.3791,
        longitude: 4.9003,
        visibility: "public",
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Link Grand Hotel Paris as an associated location of the trip
    await db.insert(relationships).values({
      id: `rel_test_assoc_1`,
      sourceType: "trip",
      sourceId: TEST_TRIP_ID,
      targetType: "location",
      targetId: TEST_ASSOC_LOC_ID,
      relationship: "includes_location",
      createdAt: now,
    });
  });

  afterAll(async () => {
    await db.delete(tripDays).where(eq(tripDays.tripId, TEST_TRIP_ID));
    await db.delete(trips).where(eq(trips.id, TEST_TRIP_ID));
    await db
      .delete(locations)
      .where(or(eq(locations.id, TEST_ASSOC_LOC_ID), eq(locations.id, TEST_ENTITY_LOC_ID)));
    await db
      .delete(relationships)
      .where(or(eq(relationships.sourceId, TEST_TRIP_ID), eq(relationships.targetId, TEST_TRIP_ID)));
  });

  it("persists geocoded custom coordinates on day items without creating location rows", async () => {
    const day1 = await addTripDayAction(TEST_TRIP_ID, { date: "2026-10-01" });

    // Update with custom place names and coordinates (no locationId)
    const updated = await updateTripDayAction(day1.id, {
      title: "Paris Day Tour",
      primaryLocationName: "Eiffel Tower",
      primaryLocationLat: 48.8584,
      primaryLocationLng: 2.2945,
      transport: [
        {
          id: "t1",
          mode: "train",
          fromName: "Eiffel Tower",
          fromLat: 48.8584,
          fromLng: 2.2945,
          toName: "Louvre Museum",
          toLat: 48.8606,
          toLng: 2.3376,
        },
      ],
      meals: [
        {
          id: "m1",
          type: "lunch",
          place: "Café de Flore",
          lat: 48.8542,
          lng: 2.3326,
        },
      ],
      activities: [
        {
          id: "a1",
          title: "Walk along Seine",
          locationName: "Pont Neuf",
          lat: 48.8571,
          lng: 2.3413,
        },
      ],
      accommodation: {
        name: "Boutique Airbnb Le Marais",
        lat: 48.8566,
        lng: 2.3522,
      },
    });

    expect(updated).not.toBeNull();
    expect(updated!.primaryLocationName).toBe("Eiffel Tower");
    expect(updated!.primaryLocationLat).toBe(48.8584);
    expect(updated!.primaryLocationLng).toBe(2.2945);

    const parsed = parseTripDay(updated!);
    expect(parsed.transport[0].toLat).toBe(48.8606);
    expect(parsed.transport[0].toLng).toBe(2.3376);
    expect(parsed.meals[0].lat).toBe(48.8542);
    expect(parsed.activities[0].lat).toBe(48.8571);
    expect(parsed.accommodation.lat).toBe(48.8566);

    // Verify no extraneous location records were created in the locations table
    const allLocations = await db.select().from(locations).where(eq(locations.name, "Eiffel Tower"));
    expect(allLocations.length).toBe(0);
  });

  it("auto-resolves coordinates from locations table when primaryLocationId is provided, even if lat/lng are passed as null", async () => {
    const day2 = await addTripDayAction(TEST_TRIP_ID, { date: "2026-10-02" });

    // Update with primaryLocationId pointing to Amsterdam Centraal Station with lat/lng passed as null
    const updated = await updateTripDayAction(day2.id, {
      title: "Arrive in Amsterdam",
      primaryLocationId: TEST_ENTITY_LOC_ID,
      primaryLocationLat: null,
      primaryLocationLng: null,
    });

    expect(updated).not.toBeNull();
    expect(updated!.primaryLocationId).toBe(TEST_ENTITY_LOC_ID);
    expect(updated!.primaryLocationName).toBe("Amsterdam Centraal Station");
    expect(updated!.primaryLocationLat).toBe(52.3791);
    expect(updated!.primaryLocationLng).toBe(4.9003);
  });

  it("constructs chronological route stops and highlights associated locations on the map", async () => {
    const mapData = await getTripMapLocationsAction(TEST_TRIP_SLUG);

    expect(mapData.routeStops.length).toBeGreaterThanOrEqual(4);
    // Chronological order starts at Eiffel Tower on Day 1
    expect(mapData.routeStops[0].name).toBe("Eiffel Tower");
    expect(mapData.routeStops[0].dayNumber).toBe(1);
    expect(mapData.routeStops[0].latitude).toBe(48.8584);

    // Later in sequence on Day 2: Amsterdam Centraal Station
    const amsterdamStop = mapData.routeStops.find((s) => s.id === TEST_ENTITY_LOC_ID);
    expect(amsterdamStop).toBeDefined();
    expect(amsterdamStop!.dayNumber).toBe(2);

    // Associated locations from relationships: Grand Hotel Paris + auto-linked Amsterdam Centraal
    expect(mapData.associatedLocations.length).toBe(2);
    expect(mapData.associatedLocations.some((l) => l.id === TEST_ASSOC_LOC_ID)).toBe(true);
    expect(mapData.associatedLocations.some((l) => l.id === TEST_ENTITY_LOC_ID)).toBe(true);
    expect(mapData.associatedLocations.every((l) => l.isAssociatedLocation)).toBe(true);

    // In orderedLocations, the associated location is present and highlighted
    const assocInMap = mapData.orderedLocations.find((l) => l.id === TEST_ASSOC_LOC_ID);
    expect(assocInMap).toBeDefined();
    expect(assocInMap!.isAssociatedLocation).toBe(true);
    expect(assocInMap!.stopType).toBe("associated");
  });

  it("supports intermediate transit waypoints in transport legs and places them in sequential route order", async () => {
    const day3 = await addTripDayAction(TEST_TRIP_ID, { date: "2026-10-03" });

    // Update with a transport leg that has intermediate waypoints (Brussels and Antwerp)
    const updated = await updateTripDayAction(day3.id, {
      title: "Paris to Amsterdam via Belgium",
      transport: [
        {
          id: "t_wp_1",
          mode: "train",
          fromName: "Paris Nord",
          fromLat: 48.8809,
          fromLng: 2.3553,
          waypoints: [
            {
              id: "wp_brussels",
              name: "Brussels Midi",
              latitude: 50.8357,
              longitude: 4.3364,
            },
            {
              id: "wp_antwerp",
              name: "Antwerpen-Centraal",
              latitude: 51.2172,
              longitude: 4.4214,
            },
          ],
          toName: "Amsterdam Centraal",
          toLat: 52.3791,
          toLng: 4.9003,
        },
      ],
    });

    expect(updated).not.toBeNull();
    const parsed = parseTripDay(updated!);
    expect(parsed.transport[0].waypoints).toBeDefined();
    expect(parsed.transport[0].waypoints!.length).toBe(2);
    expect(parsed.transport[0].waypoints![0].name).toBe("Brussels Midi");
    expect(parsed.transport[0].waypoints![1].name).toBe("Antwerpen-Centraal");

    const mapData = await getTripMapLocationsAction(TEST_TRIP_SLUG);
    const brusselsStop = mapData.routeStops.find((s) => s.name === "Brussels Midi");
    const antwerpStop = mapData.routeStops.find((s) => s.name === "Antwerpen-Centraal");

    expect(brusselsStop).toBeDefined();
    expect(brusselsStop!.stopType).toBe("transport_waypoint");
    expect(brusselsStop!.transportMode).toBe("train");
    expect(brusselsStop!.latitude).toBe(50.8357);

    expect(antwerpStop).toBeDefined();
    expect(antwerpStop!.stopType).toBe("transport_waypoint");
    expect(antwerpStop!.transportMode).toBe("train");
    expect(antwerpStop!.latitude).toBe(51.2172);

    // Verify sequential ordering: Brussels comes before Antwerp
    expect(brusselsStop!.order).toBeLessThan(antwerpStop!.order);
  });
});
