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
}

export async function getComprehensiveSystemStats(): Promise<ComprehensiveSystemStats> {
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

  return {
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
  };
}
