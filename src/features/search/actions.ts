"use server";

import { db, ensureDbInitialized } from "@/db";
import {
  microblogs,
  gallery,
  projects,
  locations,
  trips,
  collections,
  traktMovies,
  traktShows,
  lastfmArtists,
  lastfmAlbums,
  lastfmTracks,
  notes,
  bookmarks,
  quotes,
} from "@/db/schema";
import { like, or } from "drizzle-orm";

export interface SearchResultItem {
  id: string;
  type: string; // 'microblog' | 'gallery' | 'project' | 'location' | 'trip' | 'collection' | 'movie' | 'show' | 'artist' | 'album' | 'track' | 'note' | 'bookmark' | 'quote'
  title: string;
  subtitle?: string;
  url: string;
}

export async function searchEverything(query: string): Promise<SearchResultItem[]> {
  if (!query || query.trim().length < 2) return [];
  await ensureDbInitialized();

  const term = `%${query.trim().toLowerCase()}%`;
  const results: SearchResultItem[] = [];

  // 1. Microblogs
  const mRes = await db
    .select()
    .from(microblogs)
    .where(or(like(microblogs.contentMarkdown, term), like(microblogs.slug, term)))
    .limit(5);
  for (const item of mRes) {
    results.push({
      id: item.id,
      type: "microblog",
      title: item.slug,
      subtitle: item.contentMarkdown.substring(0, 80) + "...",
      url: `/microblog/${item.id}`,
    });
  }

  // 2. Gallery
  const gRes = await db
    .select()
    .from(gallery)
    .where(or(like(gallery.title, term), like(gallery.slug, term), like(gallery.description, term)))
    .limit(5);
  for (const item of gRes) {
    results.push({
      id: item.id,
      type: "gallery",
      title: item.title,
      subtitle: item.description || item.slug,
      url: `/gallery`,
    });
  }

  // 3. Projects
  const pRes = await db
    .select()
    .from(projects)
    .where(or(like(projects.name, term), like(projects.description, term)))
    .limit(5);
  for (const item of pRes) {
    results.push({
      id: item.id,
      type: "project",
      title: item.name,
      subtitle: item.description || "Project",
      url: `/todos`,
    });
  }

  // 4. Locations
  const lRes = await db
    .select()
    .from(locations)
    .where(or(like(locations.name, term), like(locations.city, term), like(locations.country, term)))
    .limit(5);
  for (const item of lRes) {
    results.push({
      id: item.id,
      type: "location",
      title: item.name,
      subtitle: [item.city, item.state, item.country].filter(Boolean).join(", "),
      url: `/locations`,
    });
  }

  // 5. Trips
  const tRes = await db
    .select()
    .from(trips)
    .where(or(like(trips.title, term), like(trips.description, term)))
    .limit(5);
  for (const item of tRes) {
    results.push({
      id: item.id,
      type: "trip",
      title: item.title,
      subtitle: item.description || "Trip",
      url: `/trips`,
    });
  }

  // 6. Movies
  const movRes = await db
    .select()
    .from(traktMovies)
    .where(like(traktMovies.title, term))
    .limit(5);
  for (const item of movRes) {
    results.push({
      id: item.traktId.toString(),
      type: "movie",
      title: item.title,
      subtitle: item.year ? `${item.year}` : "Movie",
      url: `/libraries/movies`,
    });
  }

  // 7. TV Shows
  const showRes = await db
    .select()
    .from(traktShows)
    .where(like(traktShows.title, term))
    .limit(5);
  for (const item of showRes) {
    results.push({
      id: item.traktId.toString(),
      type: "show",
      title: item.title,
      subtitle: item.year ? `${item.year}` : "TV Show",
      url: `/libraries/shows`,
    });
  }

  // 8. Music Artists
  const artRes = await db
    .select()
    .from(lastfmArtists)
    .where(like(lastfmArtists.artistName, term))
    .limit(5);
  for (const item of artRes) {
    results.push({
      id: item.artistName,
      type: "artist",
      title: item.artistName,
      subtitle: `${item.playCount} plays`,
      url: `/libraries/music`,
    });
  }

  // 9. Collections
  const colRes = await db
    .select()
    .from(collections)
    .where(or(like(collections.name, term), like(collections.description, term)))
    .limit(5);
  for (const item of colRes) {
    results.push({
      id: item.id,
      type: "collection",
      title: item.name,
      subtitle: item.description || "Collection",
      url: `/libraries/collections`,
    });
  }

  return results;
}
