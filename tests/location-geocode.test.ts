import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { locations } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { updateLocationCoordinatesAction } from "../src/features/locations/actions";

const TEST_GEO_LOC_ID = "loc_test_geocode_eiffel";
const TEST_GEO_LOC_SLUG = "test-eiffel-geocode";

describe("Location Entity: Mapbox Geocoding & Coordinate Save Action", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    // Create a test location with NO coordinates initially
    await db
      .insert(locations)
      .values({
        id: TEST_GEO_LOC_ID,
        name: "Eiffel Tower Landmark",
        slug: TEST_GEO_LOC_SLUG,
        city: "Paris",
        country: "France",
        latitude: null,
        longitude: null,
        visibility: "public",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(locations).where(eq(locations.id, TEST_GEO_LOC_ID));
  });

  it("successfully saves valid latitude and longitude coordinates to a location", async () => {
    // Check initial state has null coordinates
    const initial = await db.select().from(locations).where(eq(locations.id, TEST_GEO_LOC_ID)).limit(1);
    expect(initial[0]).toBeDefined();
    expect(initial[0].latitude).toBeNull();
    expect(initial[0].longitude).toBeNull();

    // Save coordinates (Eiffel Tower approx: 48.8584, 2.2945)
    const res = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: 48.8584,
      longitude: 2.2945,
    });

    expect(res.success).toBe(true);
    expect(res.location).toBeDefined();
    expect(res.location?.latitude).toBeCloseTo(48.8584, 4);
    expect(res.location?.longitude).toBeCloseTo(2.2945, 4);

    // Verify persisted directly in the database
    const updated = await db.select().from(locations).where(eq(locations.id, TEST_GEO_LOC_ID)).limit(1);
    expect(updated[0].latitude).toBeCloseTo(48.8584, 4);
    expect(updated[0].longitude).toBeCloseTo(2.2945, 4);
  });

  it("updates coordinates along with supplementary address fields", async () => {
    const res = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: 48.8584,
      longitude: 2.2945,
      city: "Paris",
      state: "Île-de-France",
      country: "France",
    });

    expect(res.success).toBe(true);
    expect(res.location?.state).toBe("Île-de-France");

    const updated = await db.select().from(locations).where(eq(locations.id, TEST_GEO_LOC_ID)).limit(1);
    expect(updated[0].state).toBe("Île-de-France");
  });

  it("rejects non-numeric coordinates", async () => {
    // Testing runtime validation with NaN (valid number type, but invalid coordinate value)
    const resNaN = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: NaN,
      longitude: 2.2945,
    });
    expect(resNaN.success).toBe(false);
    expect(resNaN.error).toMatch(/Invalid coordinates/);

    // Testing runtime validation when called with string coordinates
    const resStr = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: "48.8584" as unknown as number,
      longitude: 2.2945,
    });
    expect(resStr.success).toBe(false);
    expect(resStr.error).toMatch(/Invalid coordinates/);
  });

  it("rejects out-of-bounds coordinates", async () => {
    // Latitude must be -90..90
    const resLatHigh = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: 95.0,
      longitude: 2.2945,
    });
    expect(resLatHigh.success).toBe(false);
    expect(resLatHigh.error).toMatch(/Coordinates out of bounds/);

    const resLatLow = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: -91.0,
      longitude: 2.2945,
    });
    expect(resLatLow.success).toBe(false);
    expect(resLatLow.error).toMatch(/Coordinates out of bounds/);

    // Longitude must be -180..180
    const resLngHigh = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: 48.8584,
      longitude: 185.0,
    });
    expect(resLngHigh.success).toBe(false);
    expect(resLngHigh.error).toMatch(/Coordinates out of bounds/);

    const resLngLow = await updateLocationCoordinatesAction(TEST_GEO_LOC_ID, {
      latitude: 48.8584,
      longitude: -185.0,
    });
    expect(resLngLow.success).toBe(false);
    expect(resLngLow.error).toMatch(/Coordinates out of bounds/);
  });

  it("returns error gracefully when location ID does not exist", async () => {
    const res = await updateLocationCoordinatesAction("non_existent_loc_9999", {
      latitude: 10.0,
      longitude: 20.0,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Location not found/);
  });
});
