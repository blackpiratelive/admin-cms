import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { trips, tripDays } from "../src/db/schema";
import { eq } from "drizzle-orm";
import {
  getTripDaysAction,
  generateTripDaysFromDatesAction,
  addTripDayAction,
  updateTripDayAction,
  deleteTripDayAction,
} from "../src/features/trips/day-actions";
import {
  computeTripCostSummary,
  formatCostTotals,
  enumerateDateRange,
} from "../src/features/trips/day-helpers";

const TRIP_ID = "trip_test_days_1";

describe("Trip day-by-day journal", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    const now = new Date().toISOString();
    await db
      .insert(trips)
      .values({
        id: TRIP_ID,
        title: "Kolkata Test Trip",
        slug: "kolkata-test-trip",
        startDate: "2026-01-01",
        endDate: "2026-01-04",
        status: "completed",
        visibility: "private",
        favorite: 0,
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
    await db.delete(tripDays).where(eq(tripDays.tripId, TRIP_ID));
  });

  afterAll(async () => {
    await db.delete(tripDays).where(eq(tripDays.tripId, TRIP_ID));
    await db.delete(trips).where(eq(trips.id, TRIP_ID));
  });

  it("enumerates an inclusive ISO date range", () => {
    expect(enumerateDateRange("2026-01-01", "2026-01-04")).toEqual([
      "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04",
    ]);
    expect(enumerateDateRange("2026-01-01", null)).toEqual([]);
    expect(enumerateDateRange("2026-01-04", "2026-01-01")).toEqual([]);
  });

  it("auto-generates one day per date and is idempotent", async () => {
    const first = await generateTripDaysFromDatesAction(TRIP_ID);
    expect(first).toHaveLength(4);
    expect(first.map((d) => d.dayNumber)).toEqual([1, 2, 3, 4]);
    expect(first.map((d) => d.date)).toEqual([
      "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04",
    ]);

    // Re-running only fills gaps — no duplicates.
    const second = await generateTripDaysFromDatesAction(TRIP_ID);
    expect(second).toHaveLength(4);
  });

  it("adds, updates, and deletes a day", async () => {
    const added = await addTripDayAction(TRIP_ID, { date: "2026-01-05" });
    expect(added.dayNumber).toBe(5);

    const updated = await updateTripDayAction(added.id, {
      title: "Departure",
      transport: [
        { id: "t1", mode: "flight", fromName: "Kolkata", toName: "Delhi", cost: 4500, currency: "₹" },
      ],
      meals: [{ id: "m1", type: "lunch", place: "Airport", cost: 500, currency: "₹", rating: 4 }],
    });
    expect(updated?.title).toBe("Departure");
    expect(JSON.parse(updated!.transportJson)).toHaveLength(1);

    const reread = (await getTripDaysAction(TRIP_ID)).find((d) => d.id === added.id);
    expect(reread?.title).toBe("Departure");
    expect(JSON.parse(reread!.mealsJson)[0].place).toBe("Airport");

    const ok = await deleteTripDayAction(added.id);
    expect(ok).toBe(true);
    expect((await getTripDaysAction(TRIP_ID)).find((d) => d.id === added.id)).toBeUndefined();
  });

  it("rolls up per-day and trip-wide spend grouped by currency", async () => {
    const days = await getTripDaysAction(TRIP_ID);
    const target = days[0];
    await updateTripDayAction(target.id, {
      transport: [{ id: "t1", mode: "train", cost: 300, currency: "₹" }],
      meals: [
        { id: "m1", type: "lunch", cost: 200, currency: "₹" },
        { id: "m2", type: "dinner", cost: 30, currency: "$" },
      ],
      accommodation: { name: "Hotel", cost: 2000, currency: "₹" },
    });

    const summary = computeTripCostSummary(await getTripDaysAction(TRIP_ID));
    expect(summary.perDay[target.id]).toEqual({ "₹": 2500, $: 30 });
    expect(summary.total["₹"]).toBe(2500);
    expect(summary.total["$"]).toBe(30);
    expect(formatCostTotals(summary.perDay[target.id])).toBe("₹ 2,500 + $ 30");
  });
});
