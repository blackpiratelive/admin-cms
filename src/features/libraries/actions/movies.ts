"use server";

import { ensureDbInitialized, db } from "@/db";
import { traktMovies, movieMetadata, MovieMetadataRecord, TraktMovieRecord } from "@/db/schema";
import { CombinedMovie, MovieFilterOptions } from "../types";
import { getItemCollectionsAction } from "./collections";
import { recordActivityAction } from "./activities";
import { eq, inArray, like, desc, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getMoviesAction(options?: MovieFilterOptions): Promise<CombinedMovie[]> {
  await ensureDbInitialized();

  let moviesList = await db.select().from(traktMovies);
  const metadataList = await db.select().from(movieMetadata);
  const metadataMap = new Map<number, MovieMetadataRecord>();
  metadataList.forEach((m) => metadataMap.set(m.traktId, m));

  let combined: CombinedMovie[] = [];

  for (const m of moviesList) {
    const meta = metadataMap.get(m.traktId) || null;
    combined.push({
      movie: m,
      metadata: meta,
      collections: [],
    });
  }

  // Apply filters
  if (options) {
    if (options.query) {
      const q = options.query.toLowerCase().trim();
      combined = combined.filter(
        (c) =>
          c.movie.title.toLowerCase().includes(q) ||
          c.movie.overview?.toLowerCase().includes(q) ||
          c.metadata?.notes?.toLowerCase().includes(q) ||
          c.metadata?.review?.toLowerCase().includes(q)
      );
    }

    if (options.favorite) {
      combined = combined.filter((c) => c.metadata?.favorite === 1);
    }

    if (options.reviewed === "reviewed") {
      combined = combined.filter((c) => !!c.metadata?.review && c.metadata.review.trim().length > 0);
    } else if (options.reviewed === "unreviewed") {
      combined = combined.filter((c) => !c.metadata?.review || c.metadata.review.trim().length === 0);
    }

    if (options.genre) {
      combined = combined.filter((c) => {
        try {
          const genres: string[] = JSON.parse(c.movie.genres || "[]");
          return genres.some((g) => g.toLowerCase() === options.genre?.toLowerCase());
        } catch {
          return false;
        }
      });
    }

    if (options.tag) {
      combined = combined.filter((c) => {
        try {
          const tags: string[] = JSON.parse(c.metadata?.tags || "[]");
          return tags.some((t) => t.toLowerCase() === options.tag?.toLowerCase());
        } catch {
          return false;
        }
      });
    }

    if (options.visibility) {
      combined = combined.filter((c) => (c.metadata?.visibility || "public") === options.visibility);
    }

    if (options.year) {
      combined = combined.filter((c) => c.movie.year === options.year);
    }

    if (options.timeframe) {
      const now = new Date();
      if (options.timeframe === "recently_watched") {
        combined = combined.filter((c) => !!c.movie.watchedAt);
      } else if (options.timeframe === "this_year") {
        const yearStr = String(now.getFullYear());
        combined = combined.filter((c) => c.movie.watchedAt && c.movie.watchedAt.startsWith(yearStr));
      } else if (options.timeframe === "last_month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthStr = lastMonth.toISOString().slice(0, 7);
        combined = combined.filter((c) => c.movie.watchedAt && c.movie.watchedAt.startsWith(lastMonthStr));
      }
    }

    if (options.minRating) {
      combined = combined.filter(
        (c) => (c.metadata?.personalRating ?? c.movie.rating ?? 0) >= options.minRating!
      );
    }

    // Sort
    const sortBy = options.sortBy || "watched_at";
    const order = options.sortOrder || "desc";

    combined.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortBy === "watched_at") {
        valA = a.movie.watchedAt || "";
        valB = b.movie.watchedAt || "";
      } else if (sortBy === "title") {
        valA = a.movie.title.toLowerCase();
        valB = b.movie.title.toLowerCase();
      } else if (sortBy === "year") {
        valA = a.movie.year || 0;
        valB = b.movie.year || 0;
      } else if (sortBy === "rating") {
        valA = a.movie.rating || 0;
        valB = b.movie.rating || 0;
      } else if (sortBy === "personal_rating") {
        valA = a.metadata?.personalRating || 0;
        valB = b.metadata?.personalRating || 0;
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }

  return combined;
}

export async function getRecentMoviesAction(limit = 4): Promise<CombinedMovie[]> {
  await ensureDbInitialized();
  const movies = await db
    .select()
    .from(traktMovies)
    .where(sql`${traktMovies.watchedAt} is not null`)
    .orderBy(desc(traktMovies.watchedAt))
    .limit(limit);

  if (movies.length === 0) return [];
  const metadata = await db
    .select()
    .from(movieMetadata)
    .where(inArray(movieMetadata.traktId, movies.map((movie) => movie.traktId)));
  const metadataById = new Map(metadata.map((item) => [item.traktId, item]));

  return movies.map((movie) => ({
    movie,
    metadata: metadataById.get(movie.traktId) ?? null,
    collections: [],
  }));
}

export async function getMovieDetailAction(traktId: number): Promise<CombinedMovie | null> {
  await ensureDbInitialized();

  const movieRes = await db.select().from(traktMovies).where(eq(traktMovies.traktId, traktId)).limit(1);
  if (!movieRes[0]) return null;

  // Auto-fetch missing poster artwork from TMDB using tmdbId if available
  if (!movieRes[0].posterPath && movieRes[0].tmdbId && process.env.TMDB_API_KEY) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${movieRes[0].tmdbId}?api_key=${process.env.TMDB_API_KEY.trim()}`);
      if (res.ok) {
        const data = await res.json();
        const posterPath = data.poster_path || null;
        const backdropPath = data.backdrop_path || null;
        if (posterPath || backdropPath) {
          const now = new Date().toISOString();
          await db.update(traktMovies).set({ posterPath, backdropPath, updatedAt: now }).where(eq(traktMovies.traktId, traktId));
          movieRes[0].posterPath = posterPath;
          movieRes[0].backdropPath = backdropPath;
        }
      }
    } catch {}
  }

  const metadataRes = await db.select().from(movieMetadata).where(eq(movieMetadata.traktId, traktId)).limit(1);
  const collections = await getItemCollectionsAction("movie", traktId);

  return {
    movie: movieRes[0],
    metadata: metadataRes[0] || null,
    collections,
  };
}

export async function updateMovieMetadataAction(
  traktId: number,
  data: {
    favorite?: boolean;
    personalRating?: number | null;
    review?: string | null;
    notes?: string | null;
    tags?: string[];
    visibility?: string;
    featured?: boolean;
    watchedWith?: string[];
    watchLocation?: string | null;
    locationId?: string | null;
    tripId?: string | null;
    relatedPhotos?: string[];
    relatedMicroblogs?: string[];
    relatedBlogPosts?: string[];
  }
) {
  await ensureDbInitialized();
  const now = new Date().toISOString();
  const existing = await db.select().from(movieMetadata).where(eq(movieMetadata.traktId, traktId)).limit(1);

  const updateValues: any = {
    updatedAt: now,
  };

  if (data.favorite !== undefined) updateValues.favorite = data.favorite ? 1 : 0;
  if (data.personalRating !== undefined) updateValues.personalRating = data.personalRating;
  if (data.review !== undefined) updateValues.review = data.review;
  if (data.notes !== undefined) updateValues.notes = data.notes;
  if (data.tags !== undefined) updateValues.tags = JSON.stringify(data.tags);
  if (data.visibility !== undefined) updateValues.visibility = data.visibility;
  if (data.featured !== undefined) updateValues.featured = data.featured ? 1 : 0;
  if (data.watchedWith !== undefined) updateValues.watchedWith = JSON.stringify(data.watchedWith);
  if (data.watchLocation !== undefined) updateValues.watchLocation = data.watchLocation;
  if (data.locationId !== undefined) updateValues.locationId = data.locationId;
  if (data.tripId !== undefined) updateValues.tripId = data.tripId;
  if (data.relatedPhotos !== undefined) updateValues.relatedPhotos = JSON.stringify(data.relatedPhotos);
  if (data.relatedMicroblogs !== undefined) updateValues.relatedMicroblogs = JSON.stringify(data.relatedMicroblogs);
  if (data.relatedBlogPosts !== undefined) updateValues.relatedBlogPosts = JSON.stringify(data.relatedBlogPosts);

  if (existing[0]) {
    await db.update(movieMetadata).set(updateValues).where(eq(movieMetadata.traktId, traktId));
  } else {
    await db.insert(movieMetadata).values({
      traktId,
      favorite: data.favorite ? 1 : 0,
      personalRating: data.personalRating || null,
      review: data.review || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      visibility: data.visibility || "public",
      featured: data.featured ? 1 : 0,
      watchedWith: JSON.stringify(data.watchedWith || []),
      watchLocation: data.watchLocation || null,
      locationId: data.locationId || null,
      tripId: data.tripId || null,
      relatedPhotos: JSON.stringify(data.relatedPhotos || []),
      relatedMicroblogs: JSON.stringify(data.relatedMicroblogs || []),
      relatedBlogPosts: JSON.stringify(data.relatedBlogPosts || []),
      createdAt: now,
      updatedAt: now,
    });
  }

  const movie = await db.select().from(traktMovies).where(eq(traktMovies.traktId, traktId)).limit(1);
  const movieTitle = movie[0]?.title || `Movie #${traktId}`;

  if (data.review) {
    await recordActivityAction("review_written", "movie", String(traktId), `Reviewed ${movieTitle}`, { reviewSnippet: data.review.slice(0, 100) });
  } else if (data.favorite) {
    await recordActivityAction("movie_favorited", "movie", String(traktId), `Favorited ${movieTitle}`);
  }

  try {
    revalidatePath(`/libraries/movies`);
    revalidatePath(`/libraries/movies/${traktId}`);
  } catch {}
  return { success: true };
}

export async function bulkUpdateMoviesAction(
  traktIds: number[],
  updates: {
    addTags?: string[];
    removeTags?: string[];
    visibility?: string;
    favorite?: boolean;
    deleteMetadata?: boolean;
  }
) {
  await ensureDbInitialized();

  for (const id of traktIds) {
    if (updates.deleteMetadata) {
      await db.delete(movieMetadata).where(eq(movieMetadata.traktId, id));
      continue;
    }

    const existing = await db.select().from(movieMetadata).where(eq(movieMetadata.traktId, id)).limit(1);
    let currentTags: string[] = [];
    if (existing[0]?.tags) {
      try {
        currentTags = JSON.parse(existing[0].tags);
      } catch {}
    }

    if (updates.addTags) {
      updates.addTags.forEach((t) => {
        if (!currentTags.includes(t)) currentTags.push(t);
      });
    }

    if (updates.removeTags) {
      currentTags = currentTags.filter((t) => !updates.removeTags?.includes(t));
    }

    await updateMovieMetadataAction(id, {
      tags: currentTags,
      ...(updates.visibility ? { visibility: updates.visibility } : {}),
      ...(updates.favorite !== undefined ? { favorite: updates.favorite } : {}),
    });
  }

  revalidatePath(`/libraries/movies`);
  return { success: true };
}
