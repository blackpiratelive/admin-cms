import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";
import { db, ensureDbInitialized } from "@/db";
import {
  lastfmScrobbles,
  lastfmArtists,
  lastfmAlbums,
  lastfmTracks,
  providers,
} from "@/db/schema";
import { eq, count } from "drizzle-orm";

export class LastfmSyncProvider extends BaseSyncProvider {
  id = "lastfm";
  name = "Last.fm";
  slug = "lastfm";
  icon = "🎵";
  description = "Sync listening history, scrobbles, top artists, top albums, and top tracks from Last.fm.";

  getConfigFields(): ConfigField[] {
    return [
      {
        name: "username",
        label: "Last.fm Username",
        type: "text",
        placeholder: "e.g. lastfm_user",
        required: true,
        description: "Your Last.fm profile username",
      },
      {
        name: "apiKey",
        label: "Last.fm API Key",
        type: "password",
        placeholder: "Last.fm API Key",
        required: true,
        description: "Obtain an API key from last.fm/api/account/create",
      },
    ];
  }

  async validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult> {
    if (!config.username || typeof config.username !== "string" || !config.username.trim()) {
      return { valid: false, error: "Last.fm username is required." };
    }
    if (!config.apiKey || typeof config.apiKey !== "string" || !config.apiKey.trim()) {
      return { valid: false, error: "Last.fm API Key is required." };
    }
    return { valid: true };
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const username = config.username.trim();
    const apiKey = config.apiKey.trim();
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${encodeURIComponent(
        username
      )}&api_key=${encodeURIComponent(apiKey)}&format=json`,
      {
        headers: {
          "User-Agent": "AdminCMS/1.0.0",
        },
      }
    );
    if (!res.ok) {
      throw new Error(`Last.fm API HTTP error (${res.status} ${res.statusText})`);
    }
    const data = await res.json();
    if (data.error) {
      throw new Error(`Last.fm error (${data.error}): ${data.message || "Invalid credentials or username"}`);
    }
    if (!data.user) {
      throw new Error(`Last.fm user '${username}' not found.`);
    }
    return true;
  }

  protected async executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult> {
    await ensureDbInitialized();
    const username = config.username.trim();
    const apiKey = config.apiKey.trim();
    const target = options?.target || "scrobbles";
    const mode = options?.mode || "incremental";
    const onProgress = options?.onProgress;

    let totalCreated = 0;
    let totalUpdated = 0;

    if (target === "scrobbles" || target === "all") {
      const scrobbleRes = await this.syncScrobbles(username, apiKey, mode, options);
      totalCreated += scrobbleRes.created;
      totalUpdated += scrobbleRes.updated;
    }

    if (target === "artists" || target === "all") {
      const artistRes = await this.syncTopArtists(username, apiKey, options);
      totalCreated += artistRes.created;
      totalUpdated += artistRes.updated;
    }

    if (target === "albums" || target === "all") {
      const albumRes = await this.syncTopAlbums(username, apiKey, options);
      totalCreated += albumRes.created;
      totalUpdated += albumRes.updated;
    }

    if (target === "tracks" || target === "all") {
      const trackRes = await this.syncTopTracks(username, apiKey, options);
      totalCreated += trackRes.created;
      totalUpdated += trackRes.updated;
    }

    return {
      success: true,
      itemsCreated: totalCreated,
      itemsUpdated: totalUpdated,
      itemsDeleted: 0,
      metadata: {
        target,
        mode,
      },
    };
  }

  private async syncScrobbles(
    username: string,
    apiKey: string,
    mode: string,
    options?: SyncOptions
  ): Promise<{ created: number; updated: number }> {
    const onProgress = options?.onProgress;
    const currentConfig = await this.getConfig();
    let backfillPage = options?.batchPage || currentConfig.nextBackfillPage || 1;

    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    const maxPagesToFetch = mode === "batch" ? (options?.batchSize || 10) : 3;
    let startPage = mode === "batch" ? backfillPage : 1;
    let totalPagesAvailable = 1;
    let totalScrobblesAvailable = 0;

    const processedInRun = new Set<string>();

    onProgress?.(`Starting Scrobbles sync (mode: ${mode}, fetching max ${maxPagesToFetch} pages)...`);

    for (let p = 0; p < maxPagesToFetch; p++) {
      this.checkCancelled();
      const pageToFetch = startPage + p;
      onProgress?.(`Fetching scrobbles page ${pageToFetch}...`);

      const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
        username
      )}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=200&page=${pageToFetch}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch recent tracks from Last.fm page ${pageToFetch}: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(`Last.fm error (${data.error}): ${data.message}`);
      }

      const recentTracks = data.recenttracks;
      if (!recentTracks || !recentTracks.track) break;

      const totalPages = parseInt(recentTracks["@attr"]?.totalPages || "1", 10);
      totalScrobblesAvailable = parseInt(recentTracks["@attr"]?.total || "0", 10);
      totalPagesAvailable = totalPages;

      const trackList: any[] = Array.isArray(recentTracks.track)
        ? recentTracks.track
        : [recentTracks.track];

      let newInThisPage = 0;

      for (const t of trackList) {
        if (t["@attr"]?.nowplaying === "true" || !t.date?.uts) continue;

        const uts = t.date.uts;
        const artistName = typeof t.artist === "object" ? t.artist["#text"] || t.artist.name : t.artist;
        const trackName = t.name;
        const albumName = typeof t.album === "object" ? t.album["#text"] : t.album || null;
        const mbid = t.mbid || (typeof t.artist === "object" ? t.artist.mbid : null) || null;
        const playedAtIso = new Date(parseInt(uts, 10) * 1000).toISOString();

        if (!artistName || !trackName) continue;

        const scrobbleId = `${uts}_${artistName.trim().toLowerCase()}_${trackName.trim().toLowerCase()}`;

        if (processedInRun.has(scrobbleId)) continue;
        processedInRun.add(scrobbleId);

        const existing = await db
          .select()
          .from(lastfmScrobbles)
          .where(eq(lastfmScrobbles.id, scrobbleId))
          .limit(1);

        if (!existing[0]) {
          await db
            .insert(lastfmScrobbles)
            .values({
              id: scrobbleId,
              lastfmId: uts,
              artist: artistName.trim(),
              album: albumName ? albumName.trim() : null,
              track: trackName.trim(),
              playedAt: playedAtIso,
              mbid: mbid || null,
              createdAt: now,
            })
            .onConflictDoNothing();
          itemsCreated++;
          newInThisPage++;
        }
      }

      onProgress?.(`Page ${pageToFetch}/${totalPagesAvailable}: Inserted ${newInThisPage} new scrobbles.`);

      if (mode === "incremental" && newInThisPage === 0) {
        onProgress?.("No new scrobbles found in recent page, stopping incremental sync early.");
        break;
      }
    }

    const nextBackfillPage = mode === "batch" ? startPage + maxPagesToFetch : backfillPage;
    await db
      .update(providers)
      .set({
        configurationJson: JSON.stringify({
          ...currentConfig,
          nextBackfillPage,
          totalLastfmScrobbles: totalScrobblesAvailable,
          totalPagesAvailable,
        }),
        updatedAt: now,
      })
      .where(eq(providers.slug, this.slug));

    onProgress?.(`Scrobbles sync completed. ${itemsCreated} total new scrobbles added.`);
    return { created: itemsCreated, updated: itemsUpdated };
  }

  private async syncTopArtists(
    username: string,
    apiKey: string,
    options?: SyncOptions
  ): Promise<{ created: number; updated: number }> {
    const onProgress = options?.onProgress;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    const maxPages = options?.batchSize || 10;
    onProgress?.(`Fetching top artists directly from Last.fm API (period: overall)...`);

    for (let page = 1; page <= maxPages; page++) {
      this.checkCancelled();
      onProgress?.(`Fetching top artists page ${page}...`);

      const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${encodeURIComponent(
        username
      )}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=1000&page=${page}&period=overall`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch top artists page ${page}: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(`Last.fm error (${data.error}): ${data.message}`);
      }

      const topArtists = data.topartists;
      if (!topArtists || !topArtists.artist) break;

      const totalPages = parseInt(topArtists["@attr"]?.totalPages || "1", 10);
      const artistList: any[] = Array.isArray(topArtists.artist)
        ? topArtists.artist
        : [topArtists.artist];

      if (artistList.length === 0) break;

      for (const a of artistList) {
        const artistName = a.name ? a.name.trim() : null;
        const playCount = parseInt(a.playcount || "0", 10);
        if (!artistName) continue;

        const existing = await db
          .select()
          .from(lastfmArtists)
          .where(eq(lastfmArtists.artistName, artistName))
          .limit(1);

        if (existing[0]) {
          await db
            .update(lastfmArtists)
            .set({
              playCount,
              updatedAt: now,
            })
            .where(eq(lastfmArtists.artistName, artistName));
          itemsUpdated++;
        } else {
          await db.insert(lastfmArtists).values({
            artistName,
            playCount,
            lastPlayed: null,
            firstPlayed: null,
            favorite: 0,
            notes: null,
            tags: "[]",
            hidden: 0,
            review: null,
            updatedAt: now,
          });
          itemsCreated++;
        }
      }

      onProgress?.(`Page ${page}/${totalPages}: Processed ${artistList.length} artists from Last.fm API.`);

      if (page >= totalPages) break;
    }

    onProgress?.(`Top artists sync completed! ${itemsCreated} created, ${itemsUpdated} updated with API play counts.`);
    return { created: itemsCreated, updated: itemsUpdated };
  }

  private async syncTopAlbums(
    username: string,
    apiKey: string,
    options?: SyncOptions
  ): Promise<{ created: number; updated: number }> {
    const onProgress = options?.onProgress;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    const maxPages = options?.batchSize || 10;
    onProgress?.(`Fetching top albums directly from Last.fm API (period: overall)...`);

    for (let page = 1; page <= maxPages; page++) {
      this.checkCancelled();
      onProgress?.(`Fetching top albums page ${page}...`);

      const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${encodeURIComponent(
        username
      )}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=1000&page=${page}&period=overall`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch top albums page ${page}: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(`Last.fm error (${data.error}): ${data.message}`);
      }

      const topAlbums = data.topalbums;
      if (!topAlbums || !topAlbums.album) break;

      const totalPages = parseInt(topAlbums["@attr"]?.totalPages || "1", 10);
      const albumList: any[] = Array.isArray(topAlbums.album)
        ? topAlbums.album
        : [topAlbums.album];

      if (albumList.length === 0) break;

      for (const alb of albumList) {
        const albumName = alb.name ? alb.name.trim() : null;
        const artistName = typeof alb.artist === "object" ? alb.artist.name?.trim() : alb.artist?.trim();
        const playCount = parseInt(alb.playcount || "0", 10);

        if (!albumName || !artistName) continue;

        const albumId = `${artistName.toLowerCase()}:::${albumName.toLowerCase()}`;

        const existing = await db.select().from(lastfmAlbums).where(eq(lastfmAlbums.id, albumId)).limit(1);

        if (existing[0]) {
          await db
            .update(lastfmAlbums)
            .set({
              playCount,
              updatedAt: now,
            })
            .where(eq(lastfmAlbums.id, albumId));
          itemsUpdated++;
        } else {
          await db.insert(lastfmAlbums).values({
            id: albumId,
            albumName,
            artist: artistName,
            playCount,
            lastPlayed: null,
            firstPlayed: null,
            favorite: 0,
            notes: null,
            tags: "[]",
            hidden: 0,
            review: null,
            updatedAt: now,
          });
          itemsCreated++;
        }
      }

      onProgress?.(`Page ${page}/${totalPages}: Processed ${albumList.length} albums from Last.fm API.`);

      if (page >= totalPages) break;
    }

    onProgress?.(`Top albums sync completed! ${itemsCreated} created, ${itemsUpdated} updated with API play counts.`);
    return { created: itemsCreated, updated: itemsUpdated };
  }

  private async syncTopTracks(
    username: string,
    apiKey: string,
    options?: SyncOptions
  ): Promise<{ created: number; updated: number }> {
    const onProgress = options?.onProgress;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    const maxPages = options?.batchSize || 10;
    onProgress?.(`Fetching top tracks directly from Last.fm API (period: overall)...`);

    for (let page = 1; page <= maxPages; page++) {
      this.checkCancelled();
      onProgress?.(`Fetching top tracks page ${page}...`);

      const url = `https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${encodeURIComponent(
        username
      )}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=1000&page=${page}&period=overall`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch top tracks page ${page}: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(`Last.fm error (${data.error}): ${data.message}`);
      }

      const topTracks = data.toptracks;
      if (!topTracks || !topTracks.track) break;

      const totalPages = parseInt(topTracks["@attr"]?.totalPages || "1", 10);
      const trackList: any[] = Array.isArray(topTracks.track)
        ? topTracks.track
        : [topTracks.track];

      if (trackList.length === 0) break;

      for (const trk of trackList) {
        const trackName = trk.name ? trk.name.trim() : null;
        const artistName = typeof trk.artist === "object" ? trk.artist.name?.trim() : trk.artist?.trim();
        const playCount = parseInt(trk.playcount || "0", 10);

        if (!trackName || !artistName) continue;

        const trackId = `${artistName.toLowerCase()}:::${trackName.toLowerCase()}`;

        const existing = await db.select().from(lastfmTracks).where(eq(lastfmTracks.id, trackId)).limit(1);

        if (existing[0]) {
          await db
            .update(lastfmTracks)
            .set({
              playCount,
              updatedAt: now,
            })
            .where(eq(lastfmTracks.id, trackId));
          itemsUpdated++;
        } else {
          await db.insert(lastfmTracks).values({
            id: trackId,
            trackName,
            artist: artistName,
            playCount,
            lastPlayed: null,
            firstPlayed: null,
            favorite: 0,
            notes: null,
            tags: "[]",
            hidden: 0,
            review: null,
            updatedAt: now,
          });
          itemsCreated++;
        }
      }

      onProgress?.(`Page ${page}/${totalPages}: Processed ${trackList.length} tracks from Last.fm API.`);

      if (page >= totalPages) break;
    }

    onProgress?.(`Top tracks sync completed! ${itemsCreated} created, ${itemsUpdated} updated with API play counts.`);
    return { created: itemsCreated, updated: itemsUpdated };
  }

  async getStatistics(): Promise<Record<string, number | string>> {
    await ensureDbInitialized();
    const scrobbleCount = await db.select({ count: count() }).from(lastfmScrobbles);
    const artistCount = await db.select({ count: count() }).from(lastfmArtists);
    const albumCount = await db.select({ count: count() }).from(lastfmAlbums);
    const trackCount = await db.select({ count: count() }).from(lastfmTracks);

    return {
      Scrobbles: scrobbleCount[0]?.count || 0,
      Artists: artistCount[0]?.count || 0,
      Albums: albumCount[0]?.count || 0,
      Tracks: trackCount[0]?.count || 0,
    };
  }
}
