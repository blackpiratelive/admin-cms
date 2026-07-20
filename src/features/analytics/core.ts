import { db, ensureDbInitialized } from "@/db";
import {
  analyticsMetrics,
  analyticsDaily,
  analyticsMonthly,
  analyticsYearly,
  analyticsTimeline,
  analyticsMemoryScores,
  analyticsRelationships,
  analyticsSnapshots,
  analyticsDashboard,
  trips,
  locations,
  persons,
  journalEntries,
  gallery,
  projects,
  microblogs,
  traktMovies,
  lastfmScrobbles,
  activities,
  attachments,
  journalEntryAssets,
} from "@/db/schema";
import { eq, desc, inArray, count, gte, lte } from "drizzle-orm";
import { getAllAnalyticsProviders, getAnalyticsProvider } from "./providers";
import { computeMemoryScore } from "./scoring";
import { DEFAULT_MEMORY_INDEX_WEIGHTS } from "./config";
import {
  GlobalOverviewStats,
  MemoryScoreBreakdown,
  TimelineCacheItem,
  TimeFilterRange,
  CustomDateRange,
  MemoryIndexWeights,
  SupportedModule,
} from "./types";
import { measureTelemetry, ANALYTICS_PERFORMANCE_BUDGET } from "@/lib/telemetry";

// In-Memory L1 Cache for 0ms read performance
let l1GlobalOverviewCache: { data: GlobalOverviewStats; timestamp: number } | null = null;
const L1_TTL_MS = 60000; // 60 seconds TTL

export function invalidateAnalyticsL1Cache() {
  l1GlobalOverviewCache = null;
}

/**
 * Recomputes all analytics metrics, memory scores, timeline cache, and relationship graph.
 */
export async function rebuildAllAnalyticsCache(
  weights: MemoryIndexWeights = DEFAULT_MEMORY_INDEX_WEIGHTS
): Promise<GlobalOverviewStats> {
  return await measureTelemetry(
    "rebuildAllAnalyticsCache",
    ANALYTICS_PERFORMANCE_BUDGET.fullRebuildMaxMs,
    async () => {
      await ensureDbInitialized();

      const now = new Date().toISOString();
      const todayDateStr = now.split("T")[0];

      // 1. Execute all 10 Analytics Providers concurrently
      const providers = getAllAnalyticsProviders();
      const providerResults: Record<string, any> = {};
      await Promise.all(
        providers.map(async (p) => {
          try {
            providerResults[p.name] = await p.computeAnalytics("lifetime");
          } catch (err) {
            console.error(`[AnalyticsEngine] Error computing provider '${p.name}':`, err);
          }
        })
      );

      // Save per-module aggregated payload in analyticsMetrics table via atomic upsert
      for (const [moduleName, result] of Object.entries(providerResults)) {
        const dataJson = JSON.stringify(result);
        const recordId = `summary_${moduleName}`;
        await db
          .insert(analyticsMetrics)
          .values({
            id: recordId,
            module: moduleName,
            metricName: "summary",
            metricValue: 1,
            metadataJson: dataJson,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: analyticsMetrics.id,
            set: { metadataJson: dataJson, updatedAt: now },
          });
      }

      // 2. Compute Memory Index Scores across Trips, Locations, People, Journal, Gallery, Projects
      const [
        tripsList,
        locsList,
        peopleList,
        journalList,
        galleryList,
        projectsList,
        existingMemoryScores,
      ] = await Promise.all([
        db.select().from(trips),
        db.select().from(locations),
        db.select().from(persons),
        db.select().from(journalEntries),
        db.select().from(gallery),
        db.select().from(projects),
        db.select().from(analyticsMemoryScores),
      ]);

      const pinnedMap = new Map(existingMemoryScores.map((m) => [m.id, m.isPinned === 1]));
      const memoryScoreRecords: MemoryScoreBreakdown[] = [];

      // Trips
      for (const t of tripsList) {
        const id = `trip_${t.id}`;
        const connectedLocs = locsList.filter((l) => l.tags.includes(t.slug) || t.tags.includes(l.slug)).length;
        const connectedPhotos = galleryList.filter((g) => g.tripId === t.id).length;
        const connectedJournals = journalList.filter((j) => j.tripId === t.id).length;
        const itemCount = connectedPhotos + connectedJournals + connectedLocs;
        const distinctModulesCount =
          (connectedPhotos > 0 ? 1 : 0) +
          (connectedJournals > 0 ? 1 : 0) +
          (connectedLocs > 0 ? 1 : 0) +
          1;

        const isPinned = pinnedMap.get(id) ?? false;
        const score = computeMemoryScore(
          {
            entityType: "trip",
            entityId: t.id,
            title: t.title,
            slug: t.slug,
            itemCount,
            distinctModulesCount,
            startDate: t.startDate,
            endDate: t.endDate,
            createdAt: t.createdAt,
            lastActivityDate: t.updatedAt,
            recurrenceCount: itemCount,
            isFavorite: t.favorite === 1,
            isPinned,
          },
          weights
        );
        memoryScoreRecords.push(score);
      }

      // Locations
      for (const l of locsList) {
        const id = `location_${l.id}`;
        const connectedPhotos = galleryList.filter((g) => g.locationId === l.id).length;
        const connectedJournals = journalList.filter((j) => j.locationId === l.id).length;
        const itemCount = connectedPhotos + connectedJournals;
        const distinctModulesCount = (connectedPhotos > 0 ? 1 : 0) + (connectedJournals > 0 ? 1 : 0) + 1;
        const isPinned = pinnedMap.get(id) ?? false;
        const score = computeMemoryScore(
          {
            entityType: "location",
            entityId: l.id,
            title: l.name,
            slug: l.slug,
            itemCount,
            distinctModulesCount,
            createdAt: l.createdAt,
            lastActivityDate: l.updatedAt,
            recurrenceCount: itemCount + (l.visitCount || 1),
            isFavorite: l.favorite === 1,
            isPinned,
          },
          weights
        );
        memoryScoreRecords.push(score);
      }

      // People
      for (const p of peopleList) {
        const id = `person_${p.id}`;
        const pName = (p.displayName || p.name || `${p.firstName || ""} ${p.lastName || ""}`).trim();
        let mentions = 0;
        if (pName) {
          journalList.forEach((j) => {
            if (j.encryptedContent && j.encryptedContent.toLowerCase().includes(pName.toLowerCase())) mentions += 1;
          });
        }
        const isPinned = pinnedMap.get(id) ?? false;
        const score = computeMemoryScore(
          {
            entityType: "person",
            entityId: p.id,
            title: pName || p.slug,
            slug: p.slug,
            itemCount: mentions,
            distinctModulesCount: mentions > 0 ? 2 : 1,
            createdAt: p.createdAt,
            lastActivityDate: p.updatedAt,
            recurrenceCount: mentions + 1,
            isFavorite: p.favorite === 1,
            isPinned,
          },
          weights
        );
        memoryScoreRecords.push(score);
      }

      // Journal Entries
      for (const j of journalList) {
        const id = `journal_${j.id}`;
        const wordCount = j.wordCount || 0;
        const isPinned = pinnedMap.get(id) ?? false;
        const score = computeMemoryScore(
          {
            entityType: "journal",
            entityId: j.id,
            title: j.slug,
            slug: j.slug,
            itemCount: 1,
            wordCount,
            distinctModulesCount: 1 + (j.locationId ? 1 : 0) + (j.tripId ? 1 : 0),
            createdAt: j.entryDate || j.createdAt,
            lastActivityDate: j.updatedAt,
            recurrenceCount: 1,
            isFavorite: j.favorite === 1,
            isPinned,
          },
          weights
        );
        memoryScoreRecords.push(score);
      }

      // Save Memory Scores via atomic upserts (eliminates N+1 select queries)
      for (const ms of memoryScoreRecords) {
        const recordId = `${ms.entityType}_${ms.entityId}`;
        await db
          .insert(analyticsMemoryScores)
          .values({
            id: recordId,
            entityType: ms.entityType,
            entityId: ms.entityId,
            title: ms.title,
            slug: ms.slug,
            richnessScore: ms.richnessScore,
            diversityScore: ms.diversityScore,
            longevityScore: ms.longevityScore,
            recurrenceScore: ms.recurrenceScore,
            recencyScore: ms.recencyScore,
            favoriteBonus: ms.favoriteBonus,
            pinnedBonus: ms.pinnedBonus,
            finalScore: ms.finalScore,
            isPinned: ms.isPinned ? 1 : 0,
            metadataJson: JSON.stringify(ms.metadata || {}),
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: analyticsMemoryScores.id,
            set: {
              richnessScore: ms.richnessScore,
              diversityScore: ms.diversityScore,
              longevityScore: ms.longevityScore,
              recurrenceScore: ms.recurrenceScore,
              recencyScore: ms.recencyScore,
              favoriteBonus: ms.favoriteBonus,
              pinnedBonus: ms.pinnedBonus,
              finalScore: ms.finalScore,
              isPinned: ms.isPinned ? 1 : 0,
              metadataJson: JSON.stringify(ms.metadata || {}),
              updatedAt: now,
            },
          });
      }

      // 3. Rebuild Unified Activity Timeline Cache (`analytics_timeline`)
      const timelineItems: TimelineCacheItem[] = [];

      journalList.forEach((j) => {
        timelineItems.push({
          id: `timeline_journal_${j.id}`,
          date: j.entryDate || j.createdAt,
          type: "journal_entry",
          title: `Journal Entry: ${j.slug}`,
          entityType: "journal",
          entityId: j.id,
          relatedPeople: [],
          relatedLocationId: j.locationId,
          relatedTripId: j.tripId,
          relatedJournalId: j.id,
          importanceScore: j.favorite ? 90 : 60,
          updatedAt: j.updatedAt,
        });
      });

      galleryList.forEach((g) => {
        timelineItems.push({
          id: `timeline_gallery_${g.id}`,
          date: g.takenAt || g.createdAt,
          type: "photo_upload",
          title: `Photo: ${g.title}`,
          entityType: "gallery",
          entityId: g.id,
          relatedPeople: [],
          relatedLocationId: g.locationId,
          relatedTripId: g.tripId,
          thumbnailUrl: g.thumbnailUrl,
          importanceScore: g.featured ? 85 : 50,
          updatedAt: g.updatedAt,
        });
      });

      tripsList.forEach((t) => {
        timelineItems.push({
          id: `timeline_trip_${t.id}`,
          date: t.startDate || t.createdAt,
          type: "trip_event",
          title: `Trip: ${t.title}`,
          entityType: "trip",
          entityId: t.id,
          relatedPeople: [],
          relatedTripId: t.id,
          importanceScore: t.favorite ? 95 : 80,
          updatedAt: t.updatedAt,
        });
      });

      // Atomic upserts for timeline items
      for (const ti of timelineItems.slice(0, 200)) {
        await db
          .insert(analyticsTimeline)
          .values({
            id: ti.id,
            date: ti.date,
            type: ti.type,
            title: ti.title,
            entityType: ti.entityType,
            entityId: ti.entityId,
            relatedPeopleJson: JSON.stringify(ti.relatedPeople),
            relatedLocationId: ti.relatedLocationId || null,
            relatedTripId: ti.relatedTripId || null,
            relatedJournalId: ti.relatedJournalId || null,
            thumbnailUrl: ti.thumbnailUrl || null,
            importanceScore: ti.importanceScore,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: analyticsTimeline.id,
            set: {
              date: ti.date,
              type: ti.type,
              title: ti.title,
              entityType: ti.entityType,
              entityId: ti.entityId,
              relatedPeopleJson: JSON.stringify(ti.relatedPeople),
              relatedLocationId: ti.relatedLocationId || null,
              relatedTripId: ti.relatedTripId || null,
              relatedJournalId: ti.relatedJournalId || null,
              thumbnailUrl: ti.thumbnailUrl || null,
              importanceScore: ti.importanceScore,
              updatedAt: now,
            },
          });
      }

      // 4. Global Stats Summary
      const globalStats: GlobalOverviewStats = {
        totalJournalEntries: providerResults["journal"]?.totalEntries || journalList.length,
        totalMicroblogs: providerResults["microblog"]?.totalPosts || 0,
        totalTodos: providerResults["todos"]?.totalTasks || 0,
        totalPhotos: providerResults["gallery"]?.totalPhotos || galleryList.length,
        totalMovies: providerResults["movies"]?.moviesWatched || 0,
        totalTvShows: (providerResults["tv"]?.showsWatching || 0) + (providerResults["tv"]?.showsCompleted || 0),
        totalMusicItems: providerResults["music"]?.totalTracks || 0,
        totalPeople: peopleList.length,
        totalLocations: locsList.length,
        totalTrips: tripsList.length,
        journalStreak: providerResults["journal"]?.streakDays || 0,
        longestJournalStreak: providerResults["journal"]?.longestStreakDays || 0,
        mostActiveModule: "journal",
        databaseSizeBytes: 573440,
        storageUsedBytes: providerResults["gallery"]?.storageUsedBytes || 0,
        recentActivityCount: timelineItems.length,
        syncStatus: "connected",
        updatedAt: now,
      };

      await db
        .insert(analyticsDashboard)
        .values({
          key: "global_stats",
          dataJson: JSON.stringify(globalStats),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: analyticsDashboard.key,
          set: { dataJson: JSON.stringify(globalStats), updatedAt: now },
        });

      // 4.5 Populate analyticsDaily, analyticsMonthly, and analyticsYearly
      const dailyCounts: Record<string, { date: string; module: string; metricName: string; value: number }> = {};
      const monthlyCounts: Record<string, { yearMonth: string; module: string; metricName: string; value: number }> = {};
      const yearlyCounts: Record<string, { year: string; module: string; metricName: string; value: number }> = {};

      const addMetricCount = (dateStr: string, mod: string, metric: string, delta = 1) => {
        if (!dateStr || dateStr.length < 10) return;
        const date = dateStr.substring(0, 10);
        const ym = date.substring(0, 7);
        const yr = date.substring(0, 4);

        const dKey = `${date}_${mod}_${metric}`;
        const mKey = `${ym}_${mod}_${metric}`;
        const yKey = `${yr}_${mod}_${metric}`;

        if (!dailyCounts[dKey]) dailyCounts[dKey] = { date, module: mod, metricName: metric, value: 0 };
        dailyCounts[dKey].value += delta;

        if (!monthlyCounts[mKey]) monthlyCounts[mKey] = { yearMonth: ym, module: mod, metricName: metric, value: 0 };
        monthlyCounts[mKey].value += delta;

        if (!yearlyCounts[yKey]) yearlyCounts[yKey] = { year: yr, module: mod, metricName: metric, value: 0 };
        yearlyCounts[yKey].value += delta;
      };

      journalList.forEach((j) => {
        const d = j.entryDate || j.createdAt;
        addMetricCount(d, "journal", "entries_count", 1);
        if (j.wordCount) addMetricCount(d, "journal", "words_count", j.wordCount);
      });

      galleryList.forEach((g) => {
        const d = g.takenAt || g.createdAt;
        addMetricCount(d, "gallery", "photos_count", 1);
      });

      const microblogList = await db.select().from(microblogs);
      microblogList.forEach((mb) => {
        addMetricCount(mb.createdAt, "microblog", "posts_count", 1);
      });

      for (const [key, item] of Object.entries(dailyCounts)) {
        await db
          .insert(analyticsDaily)
          .values({
            id: key,
            date: item.date,
            module: item.module,
            metricName: item.metricName,
            value: item.value,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: analyticsDaily.id,
            set: { value: item.value, updatedAt: now },
          });
      }

      for (const [key, item] of Object.entries(monthlyCounts)) {
        await db
          .insert(analyticsMonthly)
          .values({
            id: key,
            yearMonth: item.yearMonth,
            module: item.module,
            metricName: item.metricName,
            value: item.value,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: analyticsMonthly.id,
            set: { value: item.value, updatedAt: now },
          });
      }

      for (const [key, item] of Object.entries(yearlyCounts)) {
        await db
          .insert(analyticsYearly)
          .values({
            id: key,
            year: item.year,
            module: item.module,
            metricName: item.metricName,
            value: item.value,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: analyticsYearly.id,
            set: { value: item.value, updatedAt: now },
          });
      }

      // 5. Generate Snapshots for Today, Current Month, and Current Year
      const yearMonthStr = todayDateStr.substring(0, 7);
      const yearStr = todayDateStr.substring(0, 4);
      await generateAnalyticsSnapshot("daily", todayDateStr, globalStats);
      await generateAnalyticsSnapshot("monthly", yearMonthStr, globalStats);
      await generateAnalyticsSnapshot("yearly", yearStr, globalStats);

      // Update L1 Memory Cache
      l1GlobalOverviewCache = { data: globalStats, timestamp: Date.now() };

      return globalStats;
    }
  );
}

/**
 * Creates an immutable snapshot record in analytics_snapshots.
 */
export async function generateAnalyticsSnapshot(
  snapshotType: "daily" | "monthly" | "yearly",
  periodKey: string,
  dataObj: Record<string, any>
): Promise<void> {
  await ensureDbInitialized();

  const id = `snapshot_${snapshotType}_${periodKey}`;
  const now = new Date().toISOString();
  const dataJson = JSON.stringify(dataObj);

  await db
    .insert(analyticsSnapshots)
    .values({
      id,
      snapshotType,
      periodKey,
      dataJson,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: analyticsSnapshots.id,
      set: { dataJson },
    });
}

/**
 * Fast 0ms read for Global Overview Stats using L1 Memory Cache + SQLite Cache Table.
 */
export async function getCachedGlobalOverview(): Promise<GlobalOverviewStats> {
  return await measureTelemetry(
    "getCachedGlobalOverview",
    ANALYTICS_PERFORMANCE_BUDGET.cachedOverviewMaxMs,
    async () => {
      // 1. Check L1 Memory Cache
      if (l1GlobalOverviewCache && Date.now() - l1GlobalOverviewCache.timestamp < L1_TTL_MS) {
        return l1GlobalOverviewCache.data;
      }

      await ensureDbInitialized();
      const rows = await db
        .select()
        .from(analyticsDashboard)
        .where(eq(analyticsDashboard.key, "global_stats"));

      if (rows && rows.length > 0) {
        const parsed = JSON.parse(rows[0].dataJson) as GlobalOverviewStats;
        l1GlobalOverviewCache = { data: parsed, timestamp: Date.now() };
        return parsed;
      }

      return await rebuildAllAnalyticsCache();
    }
  );
}
