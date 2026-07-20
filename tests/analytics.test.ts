import { describe, it, expect, beforeAll } from "vitest";
import { computeMemoryScore } from "@/features/analytics/scoring";
import { DEFAULT_MEMORY_INDEX_WEIGHTS } from "@/features/analytics/config";
import { getAllAnalyticsProviders, getAnalyticsProvider } from "@/features/analytics/providers";
import { rebuildAllAnalyticsCache, generateAnalyticsSnapshot, getCachedGlobalOverview } from "@/features/analytics/core";

describe("Analytics Engine & Memory Index Architecture", () => {
  it("registers and exposes all 10 analytics providers", () => {
    const providers = getAllAnalyticsProviders();
    expect(providers.length).toBe(10);

    const expectedModules = [
      "journal",
      "microblog",
      "todos",
      "gallery",
      "movies",
      "tv",
      "music",
      "people",
      "locations",
      "trips",
    ];

    expectedModules.forEach((mod) => {
      const provider = getAnalyticsProvider(mod as any);
      expect(provider).toBeDefined();
      expect(provider?.name).toBe(mod);
    });
  });

  it("calculates Memory Index scores with correct dimensional weighting", () => {
    const memoryScore = computeMemoryScore({
      entityType: "trip",
      entityId: "trip_123",
      title: "Euro Summer 2026",
      slug: "euro-summer-2026",
      itemCount: 25,
      wordCount: 1500,
      distinctModulesCount: 5,
      startDate: "2026-06-01",
      endDate: "2026-06-14",
      recurrenceCount: 12,
      isFavorite: true,
      isPinned: true,
    });

    expect(memoryScore.entityType).toBe("trip");
    expect(memoryScore.richnessScore).toBeGreaterThan(0);
    expect(memoryScore.diversityScore).toBeGreaterThan(0);
    expect(memoryScore.longevityScore).toBeGreaterThan(0);
    expect(memoryScore.recurrenceScore).toBeGreaterThan(0);
    expect(memoryScore.favoriteBonus).toBe(100);
    expect(memoryScore.pinnedBonus).toBe(100);
    expect(memoryScore.finalScore).toBeGreaterThan(50);
  });

  it("applies pinned and favorite bonuses appropriately", () => {
    const baseInput = {
      entityType: "location",
      entityId: "loc_456",
      title: "Kyoto",
      slug: "kyoto",
      itemCount: 5,
      distinctModulesCount: 2,
      recurrenceCount: 3,
      isFavorite: false,
      isPinned: false,
    };

    const scoreNormal = computeMemoryScore(baseInput);
    const scoreFav = computeMemoryScore({ ...baseInput, isFavorite: true });
    const scorePinned = computeMemoryScore({ ...baseInput, isPinned: true });

    expect(scoreFav.finalScore).toBeGreaterThan(scoreNormal.finalScore);
    expect(scorePinned.finalScore).toBeGreaterThan(scoreNormal.finalScore);
  });

  it("rebuilds all analytics caches and generates snapshots without throwing", async () => {
    const overview = await rebuildAllAnalyticsCache();
    expect(overview).toBeDefined();
    expect(overview.totalJournalEntries).toBeGreaterThanOrEqual(0);
    expect(overview.totalLocations).toBeGreaterThanOrEqual(0);
    expect(overview.journalStreak).toBeGreaterThanOrEqual(0);

    const cachedOverview = await getCachedGlobalOverview();
    expect(cachedOverview).toBeDefined();
    expect(cachedOverview.totalJournalEntries).toBe(overview.totalJournalEntries);
  });
});
