import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";
import { db, ensureDbInitialized } from "@/db";
import { movies, shows, episodes, providers } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { rebuildAllAnalyticsCache } from "@/features/analytics/core";

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

    // 1. Process Movies
    for (const m of rawMovies) {
      this.checkCancelled();
      const movieId = Number(m.movie_id);
      if (!movieId) continue;

      let year: number | null = null;
      if (m.release_date) {
        const parsedYear = parseInt(m.release_date.split("-")[0], 10);
        if (!isNaN(parsedYear)) year = parsedYear;
      }

      const existing = await db.select().from(movies).where(eq(movies.id, movieId)).limit(1);

      // Watched date
      const watchedAt = m.watched_date
        ? (m.watched_date.includes("T") ? m.watched_date : `${m.watched_date}T00:00:00Z`)
        : m.created_at || now;

      // Rating: CineTracker 1-10 user rating takes precedence, fallback to tmdb_vote_average
      const rating =
        m.user_rating != null
          ? Number(m.user_rating)
          : m.tmdb_vote_average != null
          ? Number(m.tmdb_vote_average)
          : null;

      // Review: CineTracker user_review takes precedence
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
        review: review || (existing[0]?.review ?? null),
        updatedAt: now,
      };

      if (existing[0]) {
        await db
          .update(movies)
          .set({
            ...movieData,
            favorite: existing[0].favorite,
            notes: existing[0].notes,
            visibility: existing[0].visibility,
            customTags: existing[0].customTags,
          })
          .where(eq(movies.id, movieId));
        itemsUpdated++;
      } else {
        await db
          .insert(movies)
          .values({
            ...movieData,
            favorite: 0,
            notes: null,
            visibility: "public",
            customTags: "[]",
            createdAt: now,
          })
          .onConflictDoNothing();
        itemsCreated++;
      }
    }

    // 2. Process TV Shows
    for (const s of rawShows) {
      this.checkCancelled();
      const showId = Number(s.tv_show_id);
      if (!showId) continue;

      let year: number | null = null;
      if (s.first_air_date) {
        const parsedYear = parseInt(s.first_air_date.split("-")[0], 10);
        if (!isNaN(parsedYear)) year = parsedYear;
      }

      const existingShow = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);

      // Tags: watched_where array from CineTracker as JSON string
      let customTags = "[]";
      if (Array.isArray(s.watched_where) && s.watched_where.length > 0) {
        customTags = JSON.stringify(s.watched_where);
      } else if (existingShow[0]?.customTags) {
        customTags = existingShow[0].customTags;
      }

      // Review: CineTracker user_review takes precedence
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
        favorite: s.is_favorite ? 1 : (existingShow[0]?.favorite ?? 0),
        customTags,
        review: review || (existingShow[0]?.review ?? null),
        updatedAt: now,
      };

      if (existingShow[0]) {
        await db
          .update(shows)
          .set({
            ...showData,
            notes: existingShow[0].notes,
            visibility: existingShow[0].visibility,
          })
          .where(eq(shows.id, showId));
        itemsUpdated++;
      } else {
        await db
          .insert(shows)
          .values({
            ...showData,
            notes: null,
            visibility: "public",
            createdAt: now,
          })
          .onConflictDoNothing();
        itemsCreated++;
      }
    }

    // 3. Process Episodes
    for (const ep of rawEpisodes) {
      this.checkCancelled();
      const showId = Number(ep.tv_show_id);
      const seasonNumber = Number(ep.season_number);
      const episodeNumber = Number(ep.episode_number);
      if (!showId || seasonNumber == null || episodeNumber == null) continue;

      const epId = `${showId}_s${seasonNumber}_e${episodeNumber}`;
      const watchedAt = ep.watched_date
        ? (ep.watched_date.includes("T") ? ep.watched_date : `${ep.watched_date}T00:00:00Z`)
        : ep.created_at || now;

      const rating = ep.user_rating != null ? Number(ep.user_rating) : null;

      const existingEp = await db.select().from(episodes).where(eq(episodes.id, epId)).limit(1);

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

      if (existingEp[0]) {
        await db.update(episodes).set(epData).where(eq(episodes.id, epId));
        itemsUpdated++;
      } else {
        await db
          .insert(episodes)
          .values({
            ...epData,
            createdAt: now,
          })
          .onConflictDoNothing();
        itemsCreated++;
      }
    }

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

    // Rebuild analytics in background
    try {
      await rebuildAllAnalyticsCache();
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
