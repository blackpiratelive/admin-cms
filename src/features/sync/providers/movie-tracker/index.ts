import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";
import { db, ensureDbInitialized } from "@/db";
import { movies, shows, episodes, providers } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { scheduleBackgroundAnalyticsRebuild } from "@/features/analytics/core";
import { purgeTag } from "@/lib/server-cache";
import { revalidatePath } from "next/cache";

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class MovieTrackerSyncProvider extends BaseSyncProvider {
  id = "movie_tracker";
  name = "Movie Tracker";
  slug = "movie_tracker";
  icon = "🎬";
  description = "Sync watched movies, TV shows, episodes, ratings, and reviews from CineTracker web app.";

  getConfigFields(): ConfigField[] {
    return [
      {
        name: "apiUrl",
        label: "Movie Tracker App URL",
        type: "text",
        placeholder: "https://movie-trackerh.vercel.app",
        required: true,
        description: "The base URL of your Movie Tracker / CineTracker web app.",
      },
      {
        name: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "cin_live_...",
        required: true,
        description: "Your CineTracker API key (obtained from /settings -> API Keys).",
      },
    ];
  }

  async validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult> {
    if (!config.apiUrl || typeof config.apiUrl !== "string" || !config.apiUrl.trim()) {
      return { valid: false, error: "Movie Tracker App URL is required." };
    }
    if (!config.apiKey || typeof config.apiKey !== "string" || !config.apiKey.trim()) {
      return { valid: false, error: "API Key is required." };
    }
    return { valid: true };
  }

  private normalizeUrl(urlStr: string): string {
    let url = urlStr.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, "");
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const baseUrl = this.normalizeUrl(config.apiUrl || "https://movie-trackerh.vercel.app");
    const apiKey = (config.apiKey || "").trim();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "User-Agent": "AdminCMS/1.0.0",
    };

    const res = await fetch(`${baseUrl}/api/v1/export?include=profile`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Movie Tracker API rejected key (401 Unauthorized). Please check your API key.");
      } else if (res.status === 429) {
        throw new Error("Rate limit exceeded (429 Too Many Requests). Maximum 60 requests per minute.");
      } else {
        throw new Error(`Movie Tracker API error (${res.status} ${res.statusText})`);
      }
    }

    const data = await res.json().catch(() => ({}));
    if (data.status !== "success" && !data.user) {
      throw new Error("Unexpected response from Movie Tracker export API.");
    }

    return true;
  }

  protected async executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult> {
    await ensureDbInitialized();
    const baseUrl = this.normalizeUrl(config.apiUrl || "https://movie-trackerh.vercel.app");
    const apiKey = (config.apiKey || "").trim();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "User-Agent": "AdminCMS/1.0.0",
    };

    const mode = options?.mode || "incremental";
    const currentConfig = await this.getConfig();
    let sinceParam = "";

    if (mode === "incremental" && currentConfig.lastSyncDate) {
      sinceParam = `&since=${encodeURIComponent(currentConfig.lastSyncDate)}`;
    }

    options?.onProgress?.(`Connecting to Movie Tracker API (${baseUrl})...`);
    this.checkCancelled();

    const res = await fetch(`${baseUrl}/api/v1/export?include=movies,tv,episodes${sinceParam}`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Movie Tracker API rejected key (401 Unauthorized).");
      }
      if (res.status === 429) {
        throw new Error("Movie Tracker API rate limit exceeded (429).");
      }
      throw new Error(`Failed to fetch data from Movie Tracker: ${res.status} ${res.statusText}`);
    }

    const exportData = await res.json();
    const rawMovies: any[] = exportData.movies || [];
    const rawShows: any[] = exportData.tv_shows || [];
    const rawEpisodes: any[] = exportData.episodes || [];

    options?.onProgress?.(
      `Received ${rawMovies.length} movies, ${rawShows.length} TV shows, ${rawEpisodes.length} episodes.`
    );
    this.checkCancelled();

    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    // 0. Pre-fetch existing media IDs and metadata in single batch queries to eliminate serial roundtrips
    options?.onProgress?.("Loading existing media library records from database...");
    this.checkCancelled();

    const existingMovies = await db
      .select({
        id: movies.id,
        favorite: movies.favorite,
        notes: movies.notes,
        visibility: movies.visibility,
        customTags: movies.customTags,
        review: movies.review,
      })
      .from(movies);
    const existingMovieMap = new Map(existingMovies.map((m) => [m.id, m]));

    const existingShows = await db
      .select({
        id: shows.id,
        favorite: shows.favorite,
        notes: shows.notes,
        visibility: shows.visibility,
        customTags: shows.customTags,
        review: shows.review,
      })
      .from(shows);
    const existingShowMap = new Map(existingShows.map((s) => [s.id, s]));

    const existingEpisodes = await db
      .select({ id: episodes.id })
      .from(episodes);
    const existingEpisodeSet = new Set(existingEpisodes.map((e) => e.id));

    // 1. Process Movies
    const moviesToInsert: any[] = [];
    const moviesToUpdate: { id: number; data: any }[] = [];

    for (const m of rawMovies) {
      const movieId = Number(m.movie_id);
      if (!movieId) continue;

      let year: number | null = null;
      if (m.release_date) {
        const parsedYear = parseInt(m.release_date.split("-")[0], 10);
        if (!isNaN(parsedYear)) year = parsedYear;
      }

      const existing = existingMovieMap.get(movieId);

      const watchedAt = m.watched_date
        ? (m.watched_date.includes("T") ? m.watched_date : `${m.watched_date}T00:00:00Z`)
        : m.created_at || now;

      const rating =
        m.user_rating != null
          ? Number(m.user_rating)
          : m.tmdb_vote_average != null
          ? Number(m.tmdb_vote_average)
          : null;

      const review = m.user_review != null ? String(m.user_review).trim() : null;

      const movieData = {
        id: movieId,
        tmdbId: movieId,
        title: m.title || "Untitled Movie",
        year,
        overview: m.overview || null,
        runtime: m.runtime_minutes != null ? Number(m.runtime_minutes) : null,
        rating,
        watchedAt,
        posterPath: m.poster_path || null,
        backdropPath: m.backdrop_path || null,
        review: review || (existing?.review ?? null),
        updatedAt: now,
      };

      if (existing) {
        moviesToUpdate.push({
          id: movieId,
          data: {
            ...movieData,
            favorite: existing.favorite,
            notes: existing.notes,
            visibility: existing.visibility,
            customTags: existing.customTags,
          },
        });
      } else {
        moviesToInsert.push({
          ...movieData,
          favorite: 0,
          notes: null,
          visibility: "public",
          customTags: "[]",
          createdAt: now,
        });
      }
    }

    if (moviesToInsert.length > 0) {
      options?.onProgress?.(`Inserting ${moviesToInsert.length} new movies...`);
      for (const chunk of chunkArray(moviesToInsert, 100)) {
        this.checkCancelled();
        await db.insert(movies).values(chunk).onConflictDoNothing();
        itemsCreated += chunk.length;
      }
    }

    if (moviesToUpdate.length > 0) {
      options?.onProgress?.(`Updating ${moviesToUpdate.length} existing movies in parallel...`);
      for (const chunk of chunkArray(moviesToUpdate, 25)) {
        this.checkCancelled();
        await Promise.all(
          chunk.map((item) => db.update(movies).set(item.data).where(eq(movies.id, item.id)))
        );
        itemsUpdated += chunk.length;
      }
    }

    // 2. Process TV Shows
    const showsToInsert: any[] = [];
    const showsToUpdate: { id: number; data: any }[] = [];

    for (const s of rawShows) {
      const showId = Number(s.tv_show_id);
      if (!showId) continue;

      let year: number | null = null;
      if (s.first_air_date) {
        const parsedYear = parseInt(s.first_air_date.split("-")[0], 10);
        if (!isNaN(parsedYear)) year = parsedYear;
      }

      const existingShow = existingShowMap.get(showId);

      let customTags = "[]";
      if (Array.isArray(s.watched_where) && s.watched_where.length > 0) {
        customTags = JSON.stringify(s.watched_where);
      } else if (existingShow?.customTags) {
        customTags = existingShow.customTags;
      }

      const review = s.user_review != null ? String(s.user_review).trim() : null;

      const showData = {
        id: showId,
        tmdbId: showId,
        title: s.name || "Untitled Show",
        overview: s.overview || null,
        status: null,
        year,
        posterPath: s.poster_path || null,
        backdropPath: s.backdrop_path || null,
        favorite: s.is_favorite ? 1 : (existingShow?.favorite ?? 0),
        customTags,
        review: review || (existingShow?.review ?? null),
        updatedAt: now,
      };

      if (existingShow) {
        showsToUpdate.push({
          id: showId,
          data: {
            ...showData,
            notes: existingShow.notes,
            visibility: existingShow.visibility,
          },
        });
      } else {
        showsToInsert.push({
          ...showData,
          notes: null,
          visibility: "public",
          createdAt: now,
        });
      }
    }

    if (showsToInsert.length > 0) {
      options?.onProgress?.(`Inserting ${showsToInsert.length} new TV shows...`);
      for (const chunk of chunkArray(showsToInsert, 100)) {
        this.checkCancelled();
        await db.insert(shows).values(chunk).onConflictDoNothing();
        itemsCreated += chunk.length;
      }
    }

    if (showsToUpdate.length > 0) {
      options?.onProgress?.(`Updating ${showsToUpdate.length} existing TV shows in parallel...`);
      for (const chunk of chunkArray(showsToUpdate, 25)) {
        this.checkCancelled();
        await Promise.all(
          chunk.map((item) => db.update(shows).set(item.data).where(eq(shows.id, item.id)))
        );
        itemsUpdated += chunk.length;
      }
    }

    // 3. Process Episodes
    const episodesToInsert: any[] = [];
    const episodesToUpdate: { id: string; data: any }[] = [];

    for (const ep of rawEpisodes) {
      const showId = Number(ep.tv_show_id);
      const seasonNumber = Number(ep.season_number);
      const episodeNumber = Number(ep.episode_number);
      if (!showId || seasonNumber == null || episodeNumber == null) continue;

      const epId = `${showId}_s${seasonNumber}_e${episodeNumber}`;
      const watchedAt = ep.watched_date
        ? (ep.watched_date.includes("T") ? ep.watched_date : `${ep.watched_date}T00:00:00Z`)
        : ep.created_at || now;

      const rating = ep.user_rating != null ? Number(ep.user_rating) : null;

      const epData = {
        id: epId,
        showId,
        episodeNumber,
        seasonNumber,
        title: ep.episode_name || null,
        watchedAt,
        rating,
        updatedAt: now,
      };

      if (existingEpisodeSet.has(epId)) {
        episodesToUpdate.push({ id: epId, data: epData });
      } else {
        episodesToInsert.push({ ...epData, createdAt: now });
      }
    }

    if (episodesToInsert.length > 0) {
      options?.onProgress?.(`Inserting ${episodesToInsert.length} episodes in bulk batches...`);
      let insertedCount = 0;
      for (const chunk of chunkArray(episodesToInsert, 100)) {
        this.checkCancelled();
        await db.insert(episodes).values(chunk).onConflictDoNothing();
        insertedCount += chunk.length;
        itemsCreated += chunk.length;
        if (insertedCount % 300 === 0 || insertedCount === episodesToInsert.length) {
          options?.onProgress?.(`Inserted ${insertedCount}/${episodesToInsert.length} episodes...`);
        }
      }
    }

    if (episodesToUpdate.length > 0) {
      options?.onProgress?.(`Updating ${episodesToUpdate.length} episodes in parallel batches...`);
      let updatedCount = 0;
      for (const chunk of chunkArray(episodesToUpdate, 25)) {
        this.checkCancelled();
        await Promise.all(
          chunk.map((item) => db.update(episodes).set(item.data).where(eq(episodes.id, item.id)))
        );
        updatedCount += chunk.length;
        itemsUpdated += chunk.length;
        if (updatedCount % 300 === 0 || updatedCount === episodesToUpdate.length) {
          options?.onProgress?.(`Updated ${updatedCount}/${episodesToUpdate.length} episodes...`);
        }
      }
    }

    // Purge server-side query caches so /libraries/movies and /libraries/shows update immediately
    try {
      purgeTag("movies-list");
      purgeTag("shows-list");
    } catch {}

    try {
      revalidatePath("/libraries/movies");
      revalidatePath("/libraries/shows");
      revalidatePath("/libraries");
    } catch {}

    // Update config with lastSyncDate
    const todayStr = now.split("T")[0];
    await db
      .update(providers)
      .set({
        configurationJson: JSON.stringify({
          ...currentConfig,
          lastSyncDate: todayStr,
        }),
        updatedAt: now,
      })
      .where(eq(providers.slug, this.slug));

    // Schedule background analytics rebuild (non-blocking microtask)
    try {
      scheduleBackgroundAnalyticsRebuild(1000);
    } catch {}

    options?.onProgress?.(`Sync completed: ${itemsCreated} created, ${itemsUpdated} updated.`);

    return {
      success: true,
      itemsCreated,
      itemsUpdated,
      itemsDeleted: 0,
      metadata: {
        moviesProcessed: rawMovies.length,
        showsProcessed: rawShows.length,
        episodesProcessed: rawEpisodes.length,
        lastSyncDate: todayStr,
      },
    };
  }

  async getStatistics(): Promise<Record<string, number | string>> {
    await ensureDbInitialized();
    const movieCount = await db.select({ count: count() }).from(movies);
    const showCount = await db.select({ count: count() }).from(shows);
    const epCount = await db.select({ count: count() }).from(episodes);

    return {
      "Movies Watched": movieCount[0]?.count || 0,
      "TV Shows": showCount[0]?.count || 0,
      Episodes: epCount[0]?.count || 0,
    };
  }
}
