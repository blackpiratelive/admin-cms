"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  analyticsMetrics,
  analyticsMemoryScores,
  analyticsTimeline,
  analyticsSnapshots,
  analyticsDashboard,
} from "@/db/schema";
import { eq, desc, inArray, count, and } from "drizzle-orm";
import { getCachedGlobalOverview, rebuildAllAnalyticsCache } from "./core";
import { getAnalyticsProvider } from "./providers";
import {
  GlobalOverviewStats,
  MemoryScoreBreakdown,
  TimelineCacheItem,
  TimeFilterRange,
  CustomDateRange,
  SupportedModule,
  AnalyticsSnapshotDTO,
} from "./types";

import { measureTelemetry, ANALYTICS_PERFORMANCE_BUDGET } from "@/lib/telemetry";
import { invalidateAnalyticsL1Cache } from "./core";

export async function getGlobalAnalyticsAction(
  timeFilter: TimeFilterRange = "lifetime",
  customRange?: CustomDateRange
): Promise<GlobalOverviewStats> {
  return await measureTelemetry(
    `getGlobalAnalyticsAction:${timeFilter}`,
    ANALYTICS_PERFORMANCE_BUDGET.cachedOverviewMaxMs,
    async () => {
      if (timeFilter === "lifetime") {
        return await getCachedGlobalOverview();
      }

      await ensureDbInitialized();
      const { getAllAnalyticsProviders } = await import("./providers");
      const providers = getAllAnalyticsProviders();
      const providerResults: Record<string, any> = {};
      await Promise.all(
        providers.map(async (p) => {
          try {
            providerResults[p.name] = await p.computeAnalytics(timeFilter, customRange);
          } catch (err) {
            console.error(`[AnalyticsEngine] Error computing provider '${p.name}':`, err);
          }
        })
      );

      const now = new Date().toISOString();
      return {
        totalJournalEntries: providerResults["journal"]?.totalEntries || 0,
        totalMicroblogs: providerResults["microblog"]?.totalPosts || 0,
        totalTodos: providerResults["todos"]?.totalTasks || 0,
        totalPhotos: providerResults["gallery"]?.totalPhotos || 0,
        totalMovies: providerResults["movies"]?.moviesWatched || 0,
        totalTvShows: (providerResults["tv"]?.showsWatching || 0) + (providerResults["tv"]?.showsCompleted || 0),
        totalMusicItems: providerResults["music"]?.totalTracks || 0,
        totalPeople: providerResults["people"]?.totalPeople || 0,
        totalLocations: providerResults["locations"]?.placesCount || 0,
        totalTrips: providerResults["trips"]?.totalTrips || 0,
        journalStreak: providerResults["journal"]?.streakDays || 0,
        longestJournalStreak: providerResults["journal"]?.longestStreakDays || 0,
        mostActiveModule: "journal",
        databaseSizeBytes: 573440,
        storageUsedBytes: providerResults["gallery"]?.storageUsedBytes || 0,
        recentActivityCount: 0,
        syncStatus: "connected",
        updatedAt: now,
      };
    }
  );
}

export async function getModuleAnalyticsAction(
  moduleName: SupportedModule,
  timeFilter: TimeFilterRange = "lifetime",
  customRange?: CustomDateRange
): Promise<any> {
  return await measureTelemetry(
    `getModuleAnalyticsAction:${moduleName}`,
    ANALYTICS_PERFORMANCE_BUDGET.cachedOverviewMaxMs,
    async () => {
      await ensureDbInitialized();

      const provider = getAnalyticsProvider(moduleName);
      if (provider) {
        return await provider.computeAnalytics(timeFilter, customRange);
      }

      // Fallback to cached analytics_metrics summary
      const rows = await db
        .select()
        .from(analyticsMetrics)
        .where(eq(analyticsMetrics.id, `summary_${moduleName}`));

      if (rows.length > 0) {
        return JSON.parse(rows[0].metadataJson);
      }

      return {};
    }
  );
}

export async function getMemoryIndexRankingsAction(
  entityType?: string,
  limit = 20
): Promise<MemoryScoreBreakdown[]> {
  return await measureTelemetry(
    "getMemoryIndexRankingsAction",
    ANALYTICS_PERFORMANCE_BUDGET.memoryIndexRankingsMaxMs,
    async () => {
      await ensureDbInitialized();

      let query = db
        .select()
        .from(analyticsMemoryScores)
        .orderBy(desc(analyticsMemoryScores.finalScore))
        .limit(limit);

      if (entityType && entityType !== "all") {
        query = db
          .select()
          .from(analyticsMemoryScores)
          .where(eq(analyticsMemoryScores.entityType, entityType))
          .orderBy(desc(analyticsMemoryScores.finalScore))
          .limit(limit) as typeof query;
      }

      const rows = await query;

      return rows.map((r) => ({
        entityType: r.entityType,
        entityId: r.entityId,
        title: r.title,
        slug: r.slug,
        richnessScore: r.richnessScore,
        diversityScore: r.diversityScore,
        longevityScore: r.longevityScore,
        recurrenceScore: r.recurrenceScore,
        recencyScore: r.recencyScore,
        favoriteBonus: r.favoriteBonus,
        pinnedBonus: r.pinnedBonus,
        finalScore: r.finalScore,
        isPinned: r.isPinned === 1,
        metadata: JSON.parse(r.metadataJson || "{}"),
        updatedAt: r.updatedAt,
      }));
    }
  );
}

export async function togglePinMemoryAction(
  entityType: string,
  entityId: string
): Promise<{ success: boolean; isPinned: boolean }> {
  await ensureDbInitialized();
  invalidateAnalyticsL1Cache();

  const recordId = `${entityType}_${entityId}`;
  const rows = await db
    .select()
    .from(analyticsMemoryScores)
    .where(eq(analyticsMemoryScores.id, recordId));

  let newPinnedState = true;

  if (rows.length > 0) {
    const currentIsPinned = rows[0].isPinned === 1;
    newPinnedState = !currentIsPinned;
    const newPinnedBonus = newPinnedState ? 100 : 0;
    const newFinalScore = Math.min(
      100,
      Number(
        (
          rows[0].richnessScore * 0.25 +
          rows[0].diversityScore * 0.2 +
          rows[0].longevityScore * 0.15 +
          rows[0].recurrenceScore * 0.15 +
          rows[0].recencyScore * 0.1 +
          rows[0].favoriteBonus * 0.08 +
          newPinnedBonus * 0.07
        ).toFixed(2)
      )
    );

    await db
      .update(analyticsMemoryScores)
      .set({
        isPinned: newPinnedState ? 1 : 0,
        pinnedBonus: newPinnedBonus,
        finalScore: newFinalScore,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(analyticsMemoryScores.id, recordId));
  } else {
    // Insert initial record
    await db.insert(analyticsMemoryScores).values({
      id: recordId,
      entityType,
      entityId,
      title: entityId,
      slug: entityId,
      richnessScore: 50,
      diversityScore: 50,
      longevityScore: 50,
      recurrenceScore: 50,
      recencyScore: 50,
      favoriteBonus: 0,
      pinnedBonus: 100,
      finalScore: 57,
      isPinned: 1,
      metadataJson: "{}",
      updatedAt: new Date().toISOString(),
    });
  }

  return { success: true, isPinned: newPinnedState };
}

export async function getUnifiedTimelineAction(
  limit = 50,
  offset = 0,
  cursorDate?: string
): Promise<TimelineCacheItem[]> {
  return await measureTelemetry(
    "getUnifiedTimelineAction",
    ANALYTICS_PERFORMANCE_BUDGET.timelineQueryMaxMs,
    async () => {
      await ensureDbInitialized();

      const rows = cursorDate
        ? await db
            .select()
            .from(analyticsTimeline)
            .where(eq(analyticsTimeline.date, cursorDate))
            .orderBy(desc(analyticsTimeline.date), desc(analyticsTimeline.importanceScore))
            .limit(limit)
        : await db
            .select()
            .from(analyticsTimeline)
            .orderBy(desc(analyticsTimeline.date), desc(analyticsTimeline.importanceScore))
            .limit(limit)
            .offset(offset);

      return rows.map((r) => ({
        id: r.id,
        date: r.date,
        type: r.type,
        title: r.title,
        entityType: r.entityType,
        entityId: r.entityId,
        relatedPeople: JSON.parse(r.relatedPeopleJson || "[]"),
        relatedLocationId: r.relatedLocationId,
        relatedTripId: r.relatedTripId,
        relatedJournalId: r.relatedJournalId,
        thumbnailUrl: r.thumbnailUrl,
        importanceScore: r.importanceScore,
        updatedAt: r.updatedAt,
      }));
    }
  );
}

export async function getHistoricalSnapshotsAction(
  snapshotType: "daily" | "monthly" | "yearly" = "daily"
): Promise<AnalyticsSnapshotDTO[]> {
  await ensureDbInitialized();

  const rows = await db
    .select()
    .from(analyticsSnapshots)
    .where(eq(analyticsSnapshots.snapshotType, snapshotType))
    .orderBy(desc(analyticsSnapshots.createdAt))
    .limit(30);

  return rows.map((r) => ({
    id: r.id,
    snapshotType: r.snapshotType as any,
    periodKey: r.periodKey,
    data: JSON.parse(r.dataJson || "{}"),
    createdAt: r.createdAt,
  }));
}

export async function rebuildAnalyticsEngineAction(): Promise<GlobalOverviewStats> {
  invalidateAnalyticsL1Cache();
  return await rebuildAllAnalyticsCache();
}
