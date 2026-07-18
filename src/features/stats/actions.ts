"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  microblogs,
  gallery,
  traktMovies,
  traktShows,
  lastfmScrobbles,
  locations,
  trips,
  projects,
  todos,
  systemStats,
} from "@/db/schema";
import { getCloudflareUsageStats, type CloudflareUsageStats } from "@/features/gallery/actions";
import { count, eq } from "drizzle-orm";

export interface ComprehensiveSystemStats {
  r2Stats: CloudflareUsageStats;
  counts: {
    microblogsTotal: number;
    microblogsPublished: number;
    microblogsDrafts: number;
    photosTotal: number;
    photosPublic: number;
    moviesTotal: number;
    showsTotal: number;
    scrobblesTotal: number;
    locationsTotal: number;
    tripsTotal: number;
    projectsTotal: number;
    openTodos: number;
  };
  updatedAt?: string;
}

/**
 * Recomputes and persists all system statistics into system_stats table.
 */
export async function rebuildSystemStatsCache(): Promise<ComprehensiveSystemStats> {
  await ensureDbInitialized();

  const [
    r2Stats,
    microblogTotals,
    galleryTotals,
    moviesTotal,
    showsTotal,
    scrobblesTotal,
    locationsTotal,
    tripsTotal,
    projectsTotal,
    openTodos,
  ] = await Promise.all([
    getCloudflareUsageStats(),
    Promise.all([
      db.select({ total: count() }).from(microblogs),
      db.select({ total: count() }).from(microblogs).where(eq(microblogs.status, "published")),
      db.select({ total: count() }).from(microblogs).where(eq(microblogs.status, "draft")),
    ]),
    Promise.all([
      db.select({ total: count() }).from(gallery),
      db.select({ total: count() }).from(gallery).where(eq(gallery.visibility, "public")),
    ]),
    db.select({ total: count() }).from(traktMovies),
    db.select({ total: count() }).from(traktShows),
    db.select({ total: count() }).from(lastfmScrobbles),
    db.select({ total: count() }).from(locations),
    db.select({ total: count() }).from(trips),
    db.select({ total: count() }).from(projects),
    db.select({ total: count() }).from(todos).where(eq(todos.completed, 0)),
  ]);

  const now = new Date().toISOString();
  const statsPayload: ComprehensiveSystemStats = {
    r2Stats,
    counts: {
      microblogsTotal: microblogTotals[0][0]?.total ?? 0,
      microblogsPublished: microblogTotals[1][0]?.total ?? 0,
      microblogsDrafts: microblogTotals[2][0]?.total ?? 0,
      photosTotal: galleryTotals[0][0]?.total ?? 0,
      photosPublic: galleryTotals[1][0]?.total ?? 0,
      moviesTotal: moviesTotal[0]?.total ?? 0,
      showsTotal: showsTotal[0]?.total ?? 0,
      scrobblesTotal: scrobblesTotal[0]?.total ?? 0,
      locationsTotal: locationsTotal[0]?.total ?? 0,
      tripsTotal: tripsTotal[0]?.total ?? 0,
      projectsTotal: projectsTotal[0]?.total ?? 0,
      openTodos: openTodos[0]?.total ?? 0,
    },
    updatedAt: now,
  };

  const existing = await db
    .select({ key: systemStats.key })
    .from(systemStats)
    .where(eq(systemStats.key, "system_stats"));

  const dataJson = JSON.stringify(statsPayload);
  if (existing.length > 0) {
    await db.update(systemStats).set({ dataJson, updatedAt: now }).where(eq(systemStats.key, "system_stats"));
  } else {
    await db.insert(systemStats).values({ key: "system_stats", dataJson, updatedAt: now });
  }

  return statsPayload;
}

/**
 * Fast 0-1ms read from precomputed system_stats table snapshot.
 */
export async function getComprehensiveSystemStats(forceRefresh = false): Promise<ComprehensiveSystemStats> {
  if (!forceRefresh) {
    try {
      await ensureDbInitialized();
      const rows = await db
        .select()
        .from(systemStats)
        .where(eq(systemStats.key, "system_stats"));

      if (rows && rows.length > 0) {
        return JSON.parse(rows[0].dataJson) as ComprehensiveSystemStats;
      }
    } catch (err) {
      console.error("Error reading system_stats snapshot:", err);
    }
  }

  return await rebuildSystemStatsCache();
}
