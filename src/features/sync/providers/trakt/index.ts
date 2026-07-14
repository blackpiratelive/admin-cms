import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";
import { db, ensureDbInitialized } from "@/db";
import { traktMovies, traktShows, traktEpisodes } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export class TraktSyncProvider extends BaseSyncProvider {
  id = "trakt";
  name = "Trakt";
  slug = "trakt";
  icon = "🎬";
  description = "Sync watched movies, TV shows, episodes, ratings, and watch history from Trakt.";

  getConfigFields(): ConfigField[] {
    return [
      {
        name: "username",
        label: "Trakt Username",
        type: "text",
        placeholder: "e.g. blackpirate",
        required: true,
        description: "Your Trakt.tv username",
      },
      {
        name: "clientId",
        label: "Trakt Client ID",
        type: "password",
        placeholder: "Trakt API Client ID",
        required: true,
        description: "Obtained from trakt.tv/oauth/applications",
      },
      {
        name: "clientSecret",
        label: "Trakt Client Secret",
        type: "password",
        placeholder: "Trakt API Client Secret",
        required: true,
        description: "Obtained alongside Client ID from your Trakt API application",
      },
    ];
  }

  async validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult> {
    if (!config.username || typeof config.username !== "string" || !config.username.trim()) {
      return { valid: false, error: "Trakt username is required." };
    }
    if (!config.clientId || typeof config.clientId !== "string" || !config.clientId.trim()) {
      return { valid: false, error: "Trakt Client ID is required." };
    }
    if (!config.clientSecret || typeof config.clientSecret !== "string" || !config.clientSecret.trim()) {
      return { valid: false, error: "Trakt Client Secret is required." };
    }
    return { valid: true };
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": config.clientId.trim(),
      "User-Agent": "AdminCMS/1.0.0",
    };
    if (config.accessToken && typeof config.accessToken === "string" && config.accessToken.trim()) {
      headers["Authorization"] = `Bearer ${config.accessToken.trim()}`;
    }

    const res = await fetch(`https://api.trakt.tv/users/${config.username.trim()}`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Trakt API rejected credentials (401 Unauthorized). Please check your Client ID.");
      } else if (res.status === 404) {
        throw new Error(`Trakt user '${config.username.trim()}' was not found (404 Not Found).`);
      } else if (res.status === 403) {
        throw new Error("Trakt API access forbidden (403 Forbidden). Check application permissions.");
      } else {
        throw new Error(`Trakt API error (${res.status} ${res.statusText})`);
      }
    }

    return true;
  }

  protected async executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult> {
    await ensureDbInitialized();
    const username = config.username.trim();
    const clientId = config.clientId.trim();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": clientId,
      "User-Agent": "AdminCMS/1.0.0",
    };
    if (config.accessToken && typeof config.accessToken === "string" && config.accessToken.trim()) {
      headers["Authorization"] = `Bearer ${config.accessToken.trim()}`;
    }

    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    // 1. Sync Watched Movies
    const moviesRes = await fetch(`https://api.trakt.tv/users/${username}/watched/movies?extended=full`, { headers });
    if (!moviesRes.ok) {
      throw new Error(`Failed to fetch watched movies from Trakt: ${moviesRes.status} ${moviesRes.statusText}`);
    }
    const watchedMovies: any[] = await moviesRes.json();

    for (const item of watchedMovies) {
      this.checkCancelled();
      const movie = item.movie;
      if (!movie || !movie.ids?.trakt) continue;

      const traktId = movie.ids.trakt;
      const existing = await db.select().from(traktMovies).where(eq(traktMovies.traktId, traktId)).limit(1);

      const movieData = {
        traktId,
        tmdbId: movie.ids.tmdb || null,
        title: movie.title || "Untitled Movie",
        year: movie.year || null,
        overview: movie.overview || null,
        runtime: movie.runtime || null,
        rating: movie.rating ? Number(movie.rating) : null,
        watchedAt: item.last_watched_at || null,
        genres: JSON.stringify(movie.genres || []),
        // Poster and backdrop paths are stored as relative TMDB paths if provided
        posterPath: movie.poster || null,
        backdropPath: movie.fanart || null,
        updatedAt: now,
      };

      if (existing[0]) {
        // Keep personal fields intact!
        await db
          .update(traktMovies)
          .set({
            ...movieData,
            favorite: existing[0].favorite,
            notes: existing[0].notes,
            visibility: existing[0].visibility,
            customTags: existing[0].customTags,
            review: existing[0].review,
          })
          .where(eq(traktMovies.traktId, traktId));
        itemsUpdated++;
      } else {
        await db
          .insert(traktMovies)
          .values({
            ...movieData,
            favorite: 0,
            notes: null,
            visibility: "public",
            customTags: "[]",
            review: null,
            createdAt: now,
          })
          .onConflictDoNothing();
        itemsCreated++;
      }
    }

    // 2. Sync Watched TV Shows & Episodes
    const showsRes = await fetch(`https://api.trakt.tv/users/${username}/watched/shows?extended=full`, { headers });
    if (!showsRes.ok) {
      throw new Error(`Failed to fetch watched TV shows from Trakt: ${showsRes.status} ${showsRes.statusText}`);
    }
    const watchedShows: any[] = await showsRes.json();

    for (const item of watchedShows) {
      const show = item.show;
      if (!show || !show.ids?.trakt) continue;

      const showTraktId = show.ids.trakt;
      const existingShow = await db.select().from(traktShows).where(eq(traktShows.traktId, showTraktId)).limit(1);

      const showData = {
        traktId: showTraktId,
        tmdbId: show.ids.tmdb || null,
        title: show.title || "Untitled Show",
        overview: show.overview || null,
        status: show.status || null,
        year: show.year || null,
        posterPath: show.poster || null,
        backdropPath: show.fanart || null,
        updatedAt: now,
      };

      if (existingShow[0]) {
        // Keep personal metadata
        await db
          .update(traktShows)
          .set({
            ...showData,
            favorite: existingShow[0].favorite,
            notes: existingShow[0].notes,
            visibility: existingShow[0].visibility,
            customTags: existingShow[0].customTags,
            review: existingShow[0].review,
          })
          .where(eq(traktShows.traktId, showTraktId));
        itemsUpdated++;
      } else {
        await db
          .insert(traktShows)
          .values({
            ...showData,
            favorite: 0,
            notes: null,
            visibility: "public",
            customTags: "[]",
            review: null,
            createdAt: now,
          })
          .onConflictDoNothing();
        itemsCreated++;
      }

      // Sync Seasons & Episodes
      if (item.seasons && Array.isArray(item.seasons)) {
        for (const season of item.seasons) {
          const seasonNumber = season.number;
          if (season.episodes && Array.isArray(season.episodes)) {
            for (const ep of season.episodes) {
              const epNumber = ep.number;
              const epId = `${showTraktId}_s${seasonNumber}_e${epNumber}`;

              const existingEp = await db.select().from(traktEpisodes).where(eq(traktEpisodes.id, epId)).limit(1);

              const epData = {
                id: epId,
                showTraktId,
                episodeNumber: epNumber,
                seasonNumber,
                title: ep.title || null,
                watchedAt: ep.last_watched_at || null,
                rating: ep.rating ? Number(ep.rating) : null,
                updatedAt: now,
              };

              if (existingEp[0]) {
                await db.update(traktEpisodes).set(epData).where(eq(traktEpisodes.id, epId));
                itemsUpdated++;
              } else {
                await db
                  .insert(traktEpisodes)
                  .values({
                    ...epData,
                    createdAt: now,
                  })
                  .onConflictDoNothing();
                itemsCreated++;
              }
            }
          }
        }
      }
    }

    return {
      success: true,
      itemsCreated,
      itemsUpdated,
      itemsDeleted: 0,
      metadata: {
        moviesImported: watchedMovies.length,
        showsImported: watchedShows.length,
      },
    };
  }

  async getStatistics(): Promise<Record<string, number | string>> {
    await ensureDbInitialized();
    const movieCount = await db.select({ count: count() }).from(traktMovies);
    const showCount = await db.select({ count: count() }).from(traktShows);
    const epCount = await db.select({ count: count() }).from(traktEpisodes);

    return {
      Movies: movieCount[0]?.count || 0,
      Shows: showCount[0]?.count || 0,
      Episodes: epCount[0]?.count || 0,
    };
  }
}
