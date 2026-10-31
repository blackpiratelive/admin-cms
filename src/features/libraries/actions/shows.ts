"use server";

import { ensureDbInitialized, db } from "@/db";
import { shows, tvShowMetadata, episodes, TvShowMetadataRecord, ShowRecord, EpisodeRecord } from "@/db/schema";
import { CombinedShow, ShowFilterOptions, PaginatedResult } from "../types";
import { getItemCollectionsAction } from "./collections";
import { recordActivityAction } from "./activities";
import { desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";

async function fetchShowsFromDb(options?: ShowFilterOptions): Promise<PaginatedResult<CombinedShow>> {
  await ensureDbInitialized();

  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);

  const showsList = await db.select({
    id: shows.id,
    tmdbId: shows.tmdbId,
    title: shows.title,
    overview: shows.overview,
    status: shows.status,
    year: shows.year,
    posterPath: shows.posterPath,
    backdropPath: shows.backdropPath,
    favorite: shows.favorite,
    notes: shows.notes,
    visibility: shows.visibility,
    customTags: shows.customTags,
    review: shows.review,
    createdAt: shows.createdAt,
    updatedAt: shows.updatedAt,
  }).from(shows);

  const metadataList = await db.select({
    showId: tvShowMetadata.showId,
    favorite: tvShowMetadata.favorite,
    personalRating: tvShowMetadata.personalRating,
    review: tvShowMetadata.review,
    notes: tvShowMetadata.notes,
    tags: tvShowMetadata.tags,
    visibility: tvShowMetadata.visibility,
    featured: tvShowMetadata.featured,
    locationId: tvShowMetadata.locationId,
    tripId: tvShowMetadata.tripId,
    createdAt: tvShowMetadata.createdAt,
    updatedAt: tvShowMetadata.updatedAt,
  }).from(tvShowMetadata);

  const episodeCounts = await db
    .select({
      showId: episodes.showId,
    })
    .from(episodes);

  const metadataMap = new Map<number, any>();
  metadataList.forEach((m) => metadataMap.set(m.showId, m));

  const episodeCountMap = new Map<number, number>();
  for (const ep of episodeCounts) {
    episodeCountMap.set(ep.showId, (episodeCountMap.get(ep.showId) || 0) + 1);
  }

  let combined: CombinedShow[] = [];

  for (const s of showsList) {
    const meta = metadataMap.get(s.id) || null;
    const epCount = episodeCountMap.get(s.id) || 0;
    const dummyEpisodes = Array.from({ length: epCount }, () => ({}) as any);

    combined.push({
      show: s as ShowRecord,
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

const getCachedPaginatedShows = createCachedQuery(
  async (optionsJson: string) => {
    const options = JSON.parse(optionsJson);
    return fetchShowsFromDb(options);
  },
  ["shows-list-query"],
  {
    revalidate: 3600,
    tags: ["shows-list"],
  }
);

export async function getPaginatedShowsAction(options?: ShowFilterOptions): Promise<PaginatedResult<CombinedShow>> {
  return getCachedPaginatedShows(JSON.stringify(options || {}));
}

export async function getShowsAction(options?: ShowFilterOptions): Promise<CombinedShow[]> {
  const res = await getPaginatedShowsAction({ ...options, limit: 1000 });
  return res.items;
}

export async function getRecentShowsAction(limit = 4): Promise<CombinedShow[]> {
  await ensureDbInitialized();
  const showsRes = await db.select().from(shows).orderBy(desc(shows.updatedAt)).limit(limit);
  if (showsRes.length === 0) return [];

  const showIds = showsRes.map((show) => show.id);
  const [metadata, episodesRes] = await Promise.all([
    db.select().from(tvShowMetadata).where(inArray(tvShowMetadata.showId, showIds)),
    db.select().from(episodes).where(inArray(episodes.showId, showIds)),
  ]);
  const metadataById = new Map(metadata.map((item) => [item.showId, item]));
  const episodesByShow = new Map<number, typeof episodesRes>();
  for (const episode of episodesRes) {
    const current = episodesByShow.get(episode.showId) ?? [];
    current.push(episode);
    episodesByShow.set(episode.showId, current);
  }

  return showsRes.map((show) => ({
    show,
    metadata: metadataById.get(show.id) ?? null,
    episodes: episodesByShow.get(show.id) ?? [],
    collections: [],
  }));
}

async function fetchShowDetailRaw(showId: number): Promise<CombinedShow | null> {
  await ensureDbInitialized();

  const showRes = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
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
          await db.update(shows).set({ posterPath, backdropPath, updatedAt: now }).where(eq(shows.id, showId));
          showRes[0].posterPath = posterPath;
          showRes[0].backdropPath = backdropPath;
        }
      }
    } catch {}
  }

  const metadataRes = await db.select().from(tvShowMetadata).where(eq(tvShowMetadata.showId, showId)).limit(1);
  const episodesRes = await db.select().from(episodes).where(eq(episodes.showId, showId));
  const collections = await getItemCollectionsAction("show", showId);

  return {
    show: showRes[0],
    metadata: metadataRes[0] || null,
    episodes: episodesRes,
    collections,
  };
}

export async function getShowDetailAction(showId: number): Promise<CombinedShow | null> {
  const cachedFn = createCachedQuery(
    () => fetchShowDetailRaw(showId),
    ["show-detail", String(showId)],
    { tags: ["shows-list", `show-${showId}`], revalidate: 3600 }
  );

  return cachedFn();
}

export async function updateShowMetadataAction(
  showId: number,
  data: {
    favorite?: boolean;
    personalRating?: number | null;
    review?: string | null;
    notes?: string | null;
    tags?: string[];
    visibility?: string;
    featured?: boolean;
    locationId?: string | null;
    tripId?: string | null;
    relatedPhotos?: string[];
    relatedPosts?: string[];
    relatedMicroblogs?: string[];
  }
) {
  await ensureDbInitialized();
  const now = new Date().toISOString();
  const existing = await db.select().from(tvShowMetadata).where(eq(tvShowMetadata.showId, showId)).limit(1);

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
  if (data.locationId !== undefined) updateValues.locationId = data.locationId;
  if (data.tripId !== undefined) updateValues.tripId = data.tripId;
  if (data.relatedPhotos !== undefined) updateValues.relatedPhotos = JSON.stringify(data.relatedPhotos);
  if (data.relatedPosts !== undefined) updateValues.relatedPosts = JSON.stringify(data.relatedPosts);
  if (data.relatedMicroblogs !== undefined) updateValues.relatedMicroblogs = JSON.stringify(data.relatedMicroblogs);

  if (existing[0]) {
    await db.update(tvShowMetadata).set(updateValues).where(eq(tvShowMetadata.showId, showId));
  } else {
    await db.insert(tvShowMetadata).values({
      showId,
      favorite: data.favorite ? 1 : 0,
      personalRating: data.personalRating || null,
      review: data.review || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      visibility: data.visibility || "public",
      featured: data.featured ? 1 : 0,
      locationId: data.locationId || null,
      tripId: data.tripId || null,
      relatedPhotos: JSON.stringify(data.relatedPhotos || []),
      relatedPosts: JSON.stringify(data.relatedPosts || []),
      relatedMicroblogs: JSON.stringify(data.relatedMicroblogs || []),
      createdAt: now,
      updatedAt: now,
    });
  }

  const show = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  const showTitle = show[0]?.title || `TV Show #${showId}`;

  if (data.review) {
    await recordActivityAction("review_written", "show", String(showId), `Reviewed ${showTitle}`, { reviewSnippet: data.review.slice(0, 100) });
  } else if (data.favorite) {
    await recordActivityAction("show_favorited", "show", String(showId), `Favorited ${showTitle}`);
  }

  try {
    purgeTag("shows-list");
    purgeTag("collections-public");
    purgeTag(`show-${showId}`);
    revalidatePath(`/libraries/shows`);
    revalidatePath(`/libraries/shows/${showId}`);
  } catch {}
  return { success: true };
}

export async function bulkUpdateShowsAction(
  showIds: number[],
  updates: {
    addTags?: string[];
    removeTags?: string[];
    visibility?: string;
    favorite?: boolean;
    deleteMetadata?: boolean;
  }
) {
  await ensureDbInitialized();

  for (const id of showIds) {
    if (updates.deleteMetadata) {
      await db.delete(tvShowMetadata).where(eq(tvShowMetadata.showId, id));
      continue;
    }

    const existing = await db.select().from(tvShowMetadata).where(eq(tvShowMetadata.showId, id)).limit(1);
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

  purgeTag("shows-list");
  purgeTag("collections-public");
  revalidatePath(`/libraries/shows`);
  return { success: true };
}
