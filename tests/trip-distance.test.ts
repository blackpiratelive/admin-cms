import { describe, it, expect } from "vitest";
import type { TripDayRecord } from "../src/db/schema";
import {
  haversineKm,
  isLegDistanceManual,
  computeLegDistanceKm,
  computeDayDistanceKm,
  computeTripDistanceSummary,
  buildDayRouteStops,
  sumRouteDistanceKm,
  formatDistanceKm,
  type TransportLeg,
} from "../src/features/trips/day-helpers";

// Reference coordinates
const DELHI = { lat: 28.6139, lng: 77.209 };
const MUMBAI = { lat: 19.076, lng: 72.8777 };
const JAIPUR = { lat: 26.9124, lng: 75.7873 };

/** Build a minimal TripDayRecord carrying the given structured lists. */
function makeDay(partial: {
  id?: string;
  dayNumber?: number;
  primaryLocationId?: string | null;
  primaryLocationLat?: number | null;
  primaryLocationLng?: number | null;
  transport?: TransportLeg[];
  meals?: any[];
  activities?: any[];
  accommodation?: any;
}): TripDayRecord {
  return {
    id: partial.id || "d1",
    tripId: "trip_x",
    dayNumber: partial.dayNumber ?? 1,
    date: null,
    title: null,
    primaryLocationId: partial.primaryLocationId ?? null,
    primaryLocationName: null,
    primaryLocationLat: partial.primaryLocationLat ?? null,
    primaryLocationLng: partial.primaryLocationLng ?? null,
    transportJson: JSON.stringify(partial.transport || []),
    mealsJson: JSON.stringify(partial.meals || []),
    activitiesJson: JSON.stringify(partial.activities || []),
    accommodationJson: JSON.stringify(partial.accommodation || {}),
    photosJson: "[]",
    weather: null,
    mood: null,
    notesMarkdown: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as unknown as TripDayRecord;
}

describe("Trip distance helpers", () => {
  it("computes great-circle distance (haversine) within tolerance", () => {
    const km = haversineKm(DELHI.lat, DELHI.lng, MUMBAI.lat, MUMBAI.lng);
    // Real-world Delhi↔Mumbai great-circle is ~1150 km.
    expect(km).toBeGreaterThan(1100);
    expect(km).toBeLessThan(1200);
    // Zero distance for identical points.
    expect(haversineKm(DELHI.lat, DELHI.lng, DELHI.lat, DELHI.lng)).toBe(0);
  });

  it("detects a usable manual distance override", () => {
    expect(isLegDistanceManual({ id: "l", mode: "car", distanceKm: 350 })).toBe(true);
    expect(isLegDistanceManual({ id: "l", mode: "car", distanceKm: 0 })).toBe(false);
    expect(isLegDistanceManual({ id: "l", mode: "car" })).toBe(false);
  });

  it("prefers manual distance over the coordinate estimate", () => {
    const leg: TransportLeg = {
      id: "l1",
      mode: "car",
      fromLat: DELHI.lat,
      fromLng: DELHI.lng,
      toLat: MUMBAI.lat,
      toLng: MUMBAI.lng,
      distanceKm: 1400,
    };
    expect(computeLegDistanceKm(leg)).toBe(1400);
  });

  it("estimates leg distance through waypoints when no manual value", () => {
    const direct = computeLegDistanceKm({
      id: "l2",
      mode: "car",
      fromLat: DELHI.lat,
      fromLng: DELHI.lng,
      toLat: MUMBAI.lat,
      toLng: MUMBAI.lng,
    })!;
    const viaJaipur = computeLegDistanceKm({
      id: "l3",
      mode: "car",
      fromLat: DELHI.lat,
      fromLng: DELHI.lng,
      toLat: MUMBAI.lat,
      toLng: MUMBAI.lng,
      waypoints: [{ id: "w", latitude: JAIPUR.lat, longitude: JAIPUR.lng }],
    })!;
    // Routing through an intermediate city is never shorter than the direct hop.
    expect(viaJaipur).toBeGreaterThanOrEqual(direct);
  });

  it("returns null when a leg lacks enough coordinates", () => {
    expect(computeLegDistanceKm({ id: "l4", mode: "flight" })).toBeNull();
    expect(
      computeLegDistanceKm({ id: "l5", mode: "flight", fromLat: DELHI.lat, fromLng: DELHI.lng })
    ).toBeNull();
  });

  it("sums logged-leg distance per day (manual + estimated)", () => {
    const day = makeDay({
      transport: [
        { id: "a", mode: "train", distanceKm: 200 },
        {
          id: "b",
          mode: "car",
          fromLat: DELHI.lat,
          fromLng: DELHI.lng,
          toLat: JAIPUR.lat,
          toLng: JAIPUR.lng,
        },
      ],
    });
    const km = computeDayDistanceKm(day);
    // 200 (manual) + ~240 (Delhi↔Jaipur) ≈ 440.
    expect(km).toBeGreaterThan(400);
    expect(km).toBeLessThan(480);
  });

  it("rolls up trip-wide logged travel and flags estimation", () => {
    const days = [
      makeDay({ id: "d1", dayNumber: 1, transport: [{ id: "a", mode: "car", distanceKm: 100 }] }),
      makeDay({
        id: "d2",
        dayNumber: 2,
        transport: [
          {
            id: "b",
            mode: "car",
            fromLat: DELHI.lat,
            fromLng: DELHI.lng,
            toLat: JAIPUR.lat,
            toLng: JAIPUR.lng,
          },
        ],
      }),
    ];
    const summary = computeTripDistanceSummary(days);
    expect(summary.perDay["d1"]).toBe(100);
    expect(summary.perDay["d2"]).toBeGreaterThan(200);
    expect(summary.total).toBeCloseTo(summary.perDay["d1"] + summary.perDay["d2"], 5);
    // d2 was estimated from coordinates → estimated flag set.
    expect(summary.estimated).toBe(true);

    const allManual = computeTripDistanceSummary([
      makeDay({ id: "x", transport: [{ id: "a", mode: "car", distanceKm: 50 }] }),
    ]);
    expect(allManual.estimated).toBe(false);
  });

  it("builds ordered route stops and sums the route distance", () => {
    const days = [
      makeDay({
        id: "d1",
        dayNumber: 1,
        primaryLocationLat: DELHI.lat,
        primaryLocationLng: DELHI.lng,
        transport: [
          {
            id: "t",
            mode: "car",
            fromLat: DELHI.lat,
            fromLng: DELHI.lng,
            toLat: JAIPUR.lat,
            toLng: JAIPUR.lng,
          },
        ],
      }),
      makeDay({
        id: "d2",
        dayNumber: 2,
        primaryLocationLat: MUMBAI.lat,
        primaryLocationLng: MUMBAI.lng,
      }),
    ];
    const stops = buildDayRouteStops(days);
    // Delhi (primary == leg.from, deduped) → Jaipur → Mumbai = 3 unique stops.
    expect(stops).toHaveLength(3);
    const km = sumRouteDistanceKm(stops);
    const legA = haversineKm(DELHI.lat, DELHI.lng, JAIPUR.lat, JAIPUR.lng);
    const legB = haversineKm(JAIPUR.lat, JAIPUR.lng, MUMBAI.lat, MUMBAI.lng);
    expect(km).toBeCloseTo(legA + legB, 2);
  });

  it("resolves missing coordinates via the resolver fallback", () => {
    const days = [
      makeDay({ id: "d1", dayNumber: 1, primaryLocationId: "loc_delhi" }),
      makeDay({ id: "d2", dayNumber: 2, primaryLocationId: "loc_mumbai" }),
    ];
    // Without a resolver, no coordinates → no stops.
    expect(buildDayRouteStops(days)).toHaveLength(0);

    const resolve = (id: string) =>
      id === "loc_delhi"
        ? { latitude: DELHI.lat, longitude: DELHI.lng }
        : id === "loc_mumbai"
        ? { latitude: MUMBAI.lat, longitude: MUMBAI.lng }
        : undefined;
    const stops = buildDayRouteStops(days, resolve);
    expect(stops).toHaveLength(2);
    expect(sumRouteDistanceKm(stops)).toBeCloseTo(
      haversineKm(DELHI.lat, DELHI.lng, MUMBAI.lat, MUMBAI.lng),
      2
    );
  });

  it("formats distances with km suffix, approximation marker and rounding", () => {
    expect(formatDistanceKm(0)).toBe("");
    expect(formatDistanceKm(-5)).toBe("");
    expect(formatDistanceKm(4.26)).toBe("4.3 km");
    expect(formatDistanceKm(1234.7)).toBe("1,235 km");
    expect(formatDistanceKm(1234.7, { approx: true })).toBe("≈ 1,235 km");
  });
});
