"use server";

import { ensureDbInitialized, db } from "@/db";
import { traktShows, tvShowMetadata, traktEpisodes, TvShowMetadataRecord, TraktShowRecord } from "@/db/schema";
import { CombinedShow, ShowFilterOptions, PaginatedResult } from "../types";
import { getItemCollectionsAction } from "./collections";
import { recordActivityAction } from "./activities";
import { desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getPaginatedShowsAction(options?: ShowFilterOptions): Promise<PaginatedResult<CombinedShow>> {
  await ensureDbInitialized();

  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);

  const showsList = await db.select({
    traktId: traktShows.traktId,
    tmdbId: traktShows.tmdbId,
    title: traktShows.title,
    overview: traktShows.overview,
    status: traktShows.status,
    year: traktShows.year,
    posterPath: traktShows.posterPath,
    backdropPath: traktShows.backdropPath,
    favorite: traktShows.favorite,
    notes: traktShows.notes,
    visibility: traktShows.visibility,
    customTags: traktShows.customTags,
    review: traktShows.review,
    createdAt: traktShows.createdAt,
    updatedAt: traktShows.updatedAt,
  }).from(traktShows);

  const metadataList = await db.select({
    traktId: tvShowMetadata.traktId,
    favorite: tvShowMetadata.favorite,
    personalRating: tvShowMetadata.personalRating,
    review: tvShowMetadata.review,
    notes: tvShowMetadata.notes,
    tags: tvShowMetadata.tags,
    visibility: tvShowMetadata.visibility,
    featured: tvShowMetadata.featured,
    createdAt: tvShowMetadata.createdAt,
    updatedAt: tvShowMetadata.updatedAt,
  }).from(tvShowMetadata);

  const episodeCounts = await db
    .select({
      showTraktId: traktEpisodes.showTraktId,
    })
    .from(traktEpisodes);

  const metadataMap = new Map<number, any>();
  metadataList.forEach((m) => metadataMap.set(m.traktId, m));

  const episodeCountMap = new Map<number, number>();
  for (const ep of episodeCounts) {
    episodeCountMap.set(ep.showTraktId, (episodeCountMap.get(ep.showTraktId) || 0) + 1);
  }

  let combined: CombinedShow[] = [];

  for (const s of showsList) {
    const meta = metadataMap.get(s.traktId) || null;
    const epCount = episodeCountMap.get(s.traktId) || 0;
    // Mock dummy array with correct length for ep.length read in ShowCard
    const dummyEpisodes = Array.from({ length: epCount }, () => ({}) as any);

    combined.push({
      show: s as TraktShowRecord,
      metadata: meta as TvShowMetadataRecord,
      episodes: dummyEpisodes,
      collections: [],
    });
  }

  // Filter
  if (options) {
    if (options.query) {
      const q = options.query.toLowerCase().trim();
      combined = combined.filter(
        (c) =>
          c.show.title.toLowerCase().includes(q) ||
          c.show.overview?.toLowerCase().includes(q) ||
          c.metadata?.notes?.toLowerCase().includes(q) ||
          c.metadata?.review?.toLowerCase().includes(q)
      );
    }

    if (options.favorite) {
      combined = combined.filter((c) => c.metadata?.favorite === 1 || c.show.favorite === 1);
    }

    if (options.status) {
      combined = combined.filter((c) => c.show.status?.toLowerCase() === options.status?.toLowerCase());
    }

    if (options.genre) {
      combined = combined.filter((c) => c.show.overview?.toLowerCase().includes(options.genre!.toLowerCase()));
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

    if (options.minRating) {
      combined = combined.filter((c) => (c.metadata?.personalRating ?? 0) >= options.minRating!);
    }

    // Sort
    const sortBy = options.sortBy || "title";
    const order = options.sortOrder || "asc";

    combined.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortBy === "title") {
        valA = a.show.title.toLowerCase();
        valB = b.show.title.toLowerCase();
      } else if (sortBy === "year") {
        valA = a.show.year || 0;
        valB = b.show.year || 0;
      } else if (sortBy === "updated_at") {
        valA = a.show.updatedAt || "";
        valB = b.show.updatedAt || "";
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }

  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;
  const paginatedItems = combined.slice(startIndex, startIndex + limit);

  return {
    items: paginatedItems,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function getShowsAction(options?: ShowFilterOptions): Promise<CombinedShow[]> {
  const res = await getPaginatedShowsAction({ ...options, limit: 1000 });
  return res.items;
}

export async function getRecentShowsAction(limit = 4): Promise<CombinedShow[]> {
  await ensureDbInitialized();
  const shows = await db.select().from(traktShows).orderBy(desc(traktShows.updatedAt)).limit(limit);
  if (shows.length === 0) return [];

  const showIds = shows.map((show) => show.traktId);
  const [metadata, episodes] = await Promise.all([
    db.select().from(tvShowMetadata).where(inArray(tvShowMetadata.traktId, showIds)),
    db.select().from(traktEpisodes).where(inArray(traktEpisodes.showTraktId, showIds)),
  ]);
  const metadataById = new Map(metadata.map((item) => [item.traktId, item]));
  const episodesByShow = new Map<number, typeof episodes>();
  for (const episode of episodes) {
    const current = episodesByShow.get(episode.showTraktId) ?? [];
    current.push(episode);
    episodesByShow.set(episode.showTraktId, current);
  }

  return shows.map((show) => ({
    show,
    metadata: metadataById.get(show.traktId) ?? null,
    episodes: episodesByShow.get(show.traktId) ?? [],
    collections: [],
  }));
}

export async function getShowDetailAction(traktId: number): Promise<CombinedShow | null> {
  await ensureDbInitialized();

  const showRes = await db.select().from(traktShows).where(eq(traktShows.traktId, traktId)).limit(1);
  if (!showRes[0]) return null;

  // Auto-fetch missing poster artwork from TMDB using tmdbId if available
  if (!showRes[0].posterPath && showRes[0].tmdbId && process.env.TMDB_API_KEY) {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${showRes[0].tmdbId}?api_key=${process.env.TMDB_API_KEY.trim()}`);
      if (res.ok) {
        const data = await res.json();
        const posterPath = data.poster_path || null;
        const backdropPath = data.backdrop_path || null;
        if (posterPath || backdropPath) {
          const now = new Date().toISOString();
          await db.update(traktShows).set({ posterPath, backdropPath, updatedAt: now }).where(eq(traktShows.traktId, traktId));
          showRes[0].posterPath = posterPath;
          showRes[0].backdropPath = backdropPath;
        }
      }
    } catch {}
  }

  const metadataRes = await db.select().from(tvShowMetadata).where(eq(tvShowMetadata.traktId, traktId)).limit(1);
  const episodes = await db.select().from(traktEpisodes).where(eq(traktEpisodes.showTraktId, traktId));
  const collections = await getItemCollectionsAction("show", traktId);

  return {
    show: showRes[0],
    metadata: metadataRes[0] || null,
    episodes,
    collections,
  };
}

export async function updateShowMetadataAction(
  traktId: number,
  data: {
    favorite?: boolean;
    personalRating?: number | null;
    review?: string | null;
    notes?: string | null;
    tags?: string[];
    visibility?: string;
    featured?: boolean;
    relatedPhotos?: string[];
    relatedPosts?: string[];
    relatedMicroblogs?: string[];
  }
) {
  await ensureDbInitialized();
  const now = new Date().toISOString();
  const existing = await db.select().from(tvShowMetadata).where(eq(tvShowMetadata.traktId, traktId)).limit(1);

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
  if (data.relatedPhotos !== undefined) updateValues.relatedPhotos = JSON.stringify(data.relatedPhotos);
  if (data.relatedPosts !== undefined) updateValues.relatedPosts = JSON.stringify(data.relatedPosts);
  if (data.relatedMicroblogs !== undefined) updateValues.relatedMicroblogs = JSON.stringify(data.relatedMicroblogs);

  if (existing[0]) {
    await db.update(tvShowMetadata).set(updateValues).where(eq(tvShowMetadata.traktId, traktId));
  } else {
    await db.insert(tvShowMetadata).values({
      traktId,
      favorite: data.favorite ? 1 : 0,
      personalRating: data.personalRating || null,
      review: data.review || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      visibility: data.visibility || "public",
      featured: data.featured ? 1 : 0,
      relatedPhotos: JSON.stringify(data.relatedPhotos || []),
      relatedPosts: JSON.stringify(data.relatedPosts || []),
      relatedMicroblogs: JSON.stringify(data.relatedMicroblogs || []),
      createdAt: now,
      updatedAt: now,
    });
  }

  const show = await db.select().from(traktShows).where(eq(traktShows.traktId, traktId)).limit(1);
  const showTitle = show[0]?.title || `TV Show #${traktId}`;

  if (data.review) {
    await recordActivityAction("review_written", "show", String(traktId), `Reviewed ${showTitle}`, { reviewSnippet: data.review.slice(0, 100) });
  } else if (data.favorite) {
    await recordActivityAction("show_favorited", "show", String(traktId), `Favorited ${showTitle}`);
  }

  try {
    revalidatePath(`/libraries/shows`);
    revalidatePath(`/libraries/shows/${traktId}`);
  } catch {}
  return { success: true };
}

export async function bulkUpdateShowsAction(
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
      await db.delete(tvShowMetadata).where(eq(tvShowMetadata.traktId, id));
      continue;
    }

    const existing = await db.select().from(tvShowMetadata).where(eq(tvShowMetadata.traktId, id)).limit(1);
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

    await updateShowMetadataAction(id, {
      tags: currentTags,
      ...(updates.visibility ? { visibility: updates.visibility } : {}),
      ...(updates.favorite !== undefined ? { favorite: updates.favorite } : {}),
    });
  }

  revalidatePath(`/libraries/shows`);
  return { success: true };
}
