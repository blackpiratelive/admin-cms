import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { locations, trips, microblogs } from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  getLocationPickerData,
  getTripPickerData,
} from "../src/features/pickers/actions";

// Distinct ids so we can assert against them without depending on other rows.
const LOC_FAV = "loc_test_pick_fav";
const LOC_OLD = "loc_test_pick_old";
const LOC_NEW = "loc_test_pick_new";
const TRIP_OLD = "trip_test_pick_old";
const TRIP_NEW = "trip_test_pick_new";
const MB_OLD = "mb_test_pick_old";
const MB_NEW = "mb_test_pick_new";

// Future timestamps so this fixture's usage always sorts to the top of recents,
// regardless of whatever real rows the shared test DB already contains.
const TS_OLD = "2098-01-01T00:00:00.000Z";
const TS_NEW = "2099-01-01T00:00:00.000Z";

async function cleanup() {
  await db.delete(microblogs).where(eq(microblogs.id, MB_OLD));
  await db.delete(microblogs).where(eq(microblogs.id, MB_NEW));
  await db.delete(locations).where(eq(locations.id, LOC_FAV));
  await db.delete(locations).where(eq(locations.id, LOC_OLD));
  await db.delete(locations).where(eq(locations.id, LOC_NEW));
  await db.delete(trips).where(eq(trips.id, TRIP_OLD));
  await db.delete(trips).where(eq(trips.id, TRIP_NEW));
}

describe("Entity picker data (options + server-derived recents)", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    await cleanup();
    const now = new Date().toISOString();

    await db.insert(locations).values([
      { id: LOC_FAV, name: "Zermatt Favorite", slug: "zermatt-fav", city: "Zermatt", country: "CH", favorite: 1, latitude: 46.0, longitude: 7.7, tags: "[]", visibility: "private", visitCount: 1, createdAt: now, updatedAt: now },
      { id: LOC_OLD, name: "Older Used Place", slug: "older-used", city: "Delhi", country: "IN", favorite: 0, tags: "[]", visibility: "private", visitCount: 1, createdAt: now, updatedAt: now },
      { id: LOC_NEW, name: "Newer Used Place", slug: "newer-used", city: "Kolkata", country: "IN", favorite: 0, tags: "[]", visibility: "private", visitCount: 1, createdAt: now, updatedAt: now },
    ]);

    await db.insert(trips).values([
      { id: TRIP_OLD, title: "Older Trip", slug: "older-trip", status: "completed", visibility: "private", favorite: 0, tags: "[]", startDate: "2026-01-01", createdAt: now, updatedAt: now },
      { id: TRIP_NEW, title: "Newer Trip", slug: "newer-trip", status: "completed", visibility: "private", favorite: 0, tags: "[]", startDate: "2026-02-01", createdAt: now, updatedAt: now },
    ]);

    // Usage rows: the "new" microblog references the newer location + trip and has
    // the most recent updatedAt, so it should rank ahead of the "old" one in recents.
    await db.insert(microblogs).values([
      { id: MB_OLD, slug: "mb-pick-old", contentMarkdown: "old", status: "published", tags: "[]", images: "[]", locationId: LOC_OLD, tripId: TRIP_OLD, createdAt: TS_OLD, updatedAt: TS_OLD },
      { id: MB_NEW, slug: "mb-pick-new", contentMarkdown: "new", status: "published", tags: "[]", images: "[]", locationId: LOC_NEW, tripId: TRIP_NEW, createdAt: TS_NEW, updatedAt: TS_NEW },
    ]);
  });

  afterAll(cleanup);

  it("returns lightweight location options with favorite flags and coordinates", async () => {
    const { options } = await getLocationPickerData();
    const fav = options.find((o) => o.id === LOC_FAV);
    expect(fav).toBeDefined();
    expect(fav!.favorite).toBe(true);
    expect(fav!.latitude).toBe(46.0);
    expect(options.find((o) => o.id === LOC_OLD)!.favorite).toBe(false);
  });

  it("orders location recents most-recently-used first", async () => {
    const { recentIds } = await getLocationPickerData();
    const iNew = recentIds.indexOf(LOC_NEW);
    const iOld = recentIds.indexOf(LOC_OLD);
    expect(iNew).toBeGreaterThanOrEqual(0);
    expect(iOld).toBeGreaterThanOrEqual(0);
    expect(iNew).toBeLessThan(iOld);
    // An unused (but existing) location is not surfaced as "recent".
    expect(recentIds).not.toContain(LOC_FAV);
  });

  it("orders trip recents most-recently-used first", async () => {
    const { options, recentIds } = await getTripPickerData();
    expect(options.some((o) => o.id === TRIP_NEW)).toBe(true);
    const iNew = recentIds.indexOf(TRIP_NEW);
    const iOld = recentIds.indexOf(TRIP_OLD);
    expect(iNew).toBeGreaterThanOrEqual(0);
    expect(iOld).toBeGreaterThanOrEqual(0);
    expect(iNew).toBeLessThan(iOld);
  });

  it("only surfaces recent ids that still resolve to a live option", async () => {
    const { options, recentIds } = await getLocationPickerData();
    const validIds = new Set(options.map((o) => o.id));
    for (const id of recentIds) expect(validIds.has(id)).toBe(true);
  });
});
