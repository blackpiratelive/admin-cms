"use server";

import { db, ensureDbInitialized } from "@/db";
import { dashboardCache } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getMicroblogDashboardData } from "@/features/microblog/actions";
import { getRecentMoviesAction } from "@/features/libraries/actions/movies";
import { getRecentShowsAction } from "@/features/libraries/actions/shows";
import { getListeningHistoryAction } from "@/features/libraries/actions/music";
import { getActivitiesAction } from "@/features/libraries/actions/activities";
import { getComprehensiveSystemStats, type ComprehensiveSystemStats } from "@/features/stats/actions";

export interface DashboardOverviewSnapshot {
  microblogData: {
    posts: Array<{
      id: string;
      slug: string;
      contentMarkdown: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
  };
  recentMovies: any[];
  recentShows: any[];
  recentScrobbles: any[];
  activities: any[];
  systemStats: ComprehensiveSystemStats;
  updatedAt: string;
}

/**
 * Extensible helper to retrieve any custom cached widget/dashboard data by key.
 */
export async function getDashboardCacheEntry<T>(key: string): Promise<{ data: T; updatedAt: string } | null> {
  try {
    await ensureDbInitialized();
    const rows = await db.select().from(dashboardCache).where(eq(dashboardCache.key, key));
    if (!rows || rows.length === 0) return null;
    return {
      data: JSON.parse(rows[0].dataJson) as T,
      updatedAt: rows[0].updatedAt,
    };
  } catch (error) {
    console.error(`Error reading dashboard cache entry for key "${key}":`, error);
    return null;
  }
}

/**
 * Extensible helper to store any custom cached widget/dashboard data by key.
 */
export async function setDashboardCacheEntry<T>(key: string, data: T): Promise<void> {
  try {
    await ensureDbInitialized();
    const now = new Date().toISOString();
    const dataJson = JSON.stringify(data);

    const existing = await db.select({ key: dashboardCache.key }).from(dashboardCache).where(eq(dashboardCache.key, key));
    if (existing.length > 0) {
      await db.update(dashboardCache).set({ dataJson, updatedAt: now }).where(eq(dashboardCache.key, key));
    } else {
      await db.insert(dashboardCache).values({ key, dataJson, updatedAt: now });
    }
  } catch (error) {
    console.error(`Error persisting dashboard cache entry for key "${key}":`, error);
  }
}

/**
 * Recomputes the entire dashboard overview dataset and saves it to the DB table.
 */
export async function rebuildDashboardCache(skipRevalidate = false): Promise<DashboardOverviewSnapshot> {
  await ensureDbInitialized();
  const now = new Date().toISOString();

  const [microblogData, recentMovies, recentShows, recentScrobbles, activities, systemStats] = await Promise.all([
    getMicroblogDashboardData(),
    getRecentMoviesAction(),
    getRecentShowsAction(),
    getListeningHistoryAction({ limit: 5 }),
    getActivitiesAction(6),
    getComprehensiveSystemStats(),
  ]);

  const snapshot: DashboardOverviewSnapshot = {
    microblogData: {
      posts: microblogData.posts.map((p) => ({
        id: p.id,
        slug: p.slug,
        contentMarkdown: p.contentMarkdown,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total: microblogData.total,
    },
    recentMovies,
    recentShows,
    recentScrobbles,
    activities,
    systemStats,
    updatedAt: now,
  };

  await setDashboardCacheEntry("dashboard_overview", snapshot);
  if (!skipRevalidate) {
    try {
      revalidatePath("/");
    } catch (e) {
      // Ignore if revalidatePath is called in a render context
    }
  }
  return snapshot;
}

/**
 * Main dashboard data loader: Reads directly from DB table cache.
 * Falls back to computing & persisting snapshot if cache entry is missing.
 */
export async function getDashboardData(forceRefresh = false): Promise<DashboardOverviewSnapshot> {
  if (!forceRefresh) {
    const cached = await getDashboardCacheEntry<DashboardOverviewSnapshot>("dashboard_overview");
    if (cached) {
      return cached.data;
    }
  }

  // Trigger background cache rebuild asynchronously without delaying response thread
  setTimeout(() => {
    rebuildDashboardCache(true).catch((err) => console.error("Async dashboard cache rebuild error:", err));
  }, 10);

  return {
    microblogData: { posts: [], total: 0 },
    recentMovies: [],
    recentShows: [],
    recentScrobbles: [],
    activities: [],
    systemStats: {
      r2Stats: {
        configured: false,
        bucketName: "gallery",
        totalPhotos: 0,
        totalObjects: 0,
        usedBytes: 0,
        usedFormatted: "0 MB",
        storageLimitFormatted: "10 GB",
        percentStorageUsed: 0,
        classALimitFormatted: "1,000,000",
        classBLimitFormatted: "10,000,000",
        egressLimitFormatted: "Unlimited",
      },
      counts: {
        microblogsTotal: 0,
        microblogsPublished: 0,
        microblogsDrafts: 0,
        photosTotal: 0,
        photosPublic: 0,
        moviesTotal: 0,
        showsTotal: 0,
        scrobblesTotal: 0,
        locationsTotal: 0,
        tripsTotal: 0,
        projectsTotal: 0,
        openTodos: 0,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Action to manually refresh dashboard DB cache on-demand.
 */
export async function refreshDashboardCacheAction() {
  try {
    const snapshot = await rebuildDashboardCache(false);
    revalidatePath("/");
    return { success: true, updatedAt: snapshot.updatedAt };
  } catch (err: any) {
    console.error("Manual dashboard cache refresh failed:", err);
    return { success: false, error: err.message || String(err) };
  }
}
