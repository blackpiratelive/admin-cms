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
import { eq } from "drizzle-orm";

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
    allMicroblogs,
    allPhotos,
    allMovies,
    allShows,
    allScrobbles,
    allLocations,
    allTrips,
    allProjects,
    allTodos,
  ] = await Promise.all([
    getCloudflareUsageStats(),
    db.select({ status: microblogs.status }).from(microblogs),
    db.select({ visibility: gallery.visibility }).from(gallery),
    db.select({ traktId: traktMovies.traktId }).from(traktMovies),
    db.select({ traktId: traktShows.traktId }).from(traktShows),
    db.select({ id: lastfmScrobbles.id }).from(lastfmScrobbles),
    db.select({ id: locations.id }).from(locations),
    db.select({ id: trips.id }).from(trips),
    db.select({ id: projects.id }).from(projects),
    db.select({ id: todos.id, completed: todos.completed }).from(todos),
  ]);

  const microblogsTotal = allMicroblogs.length;
  const microblogsPublished = allMicroblogs.filter((m) => m.status === "published").length;
  const microblogsDrafts = allMicroblogs.filter((m) => m.status === "draft").length;

  const photosTotal = allPhotos.length;
  const photosPublic = allPhotos.filter((p) => p.visibility === "public").length;

  const openTodos = allTodos.filter((t) => t.completed === 0).length;

  return {
    r2Stats,
    counts: {
      microblogsTotal,
      microblogsPublished,
      microblogsDrafts,
      photosTotal,
      photosPublic,
      moviesTotal: allMovies.length,
      showsTotal: allShows.length,
      scrobblesTotal: allScrobbles.length,
      locationsTotal: allLocations.length,
      tripsTotal: allTrips.length,
      projectsTotal: allProjects.length,
      openTodos,
    },
  };
}
