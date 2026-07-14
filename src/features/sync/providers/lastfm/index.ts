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
import { eq, count, sql } from "drizzle-orm";

export class LastfmSyncProvider extends BaseSyncProvider {
  id = "lastfm";
  name = "Last.fm";
  slug = "lastfm";
  icon = "🎵";
  description = "Sync listening history, scrobbles, top artists, albums, and tracks from Last.fm.";

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
    const mode = options?.mode || "incremental";

    const currentConfig = await this.getConfig();
    let backfillPage = options?.batchPage || currentConfig.nextBackfillPage || 1;

    let itemsCreated = 0;
    let itemsUpdated = 0;
    const now = new Date().toISOString();

    // Determine page iteration count to fit well within Vercel's 10s execution window
    // 200 items per page. 2 pages per batch in incremental, 3-5 pages per batch call
    const maxPagesToFetch = mode === "batch" ? (options?.batchSize || 3) : 2;
    let startPage = mode === "batch" ? backfillPage : 1;
    let totalPagesAvailable = 1;
    let totalScrobblesAvailable = 0;

    const touchedArtists = new Map<string, { artistName: string; playedAt: string }>();
    const touchedAlbums = new Map<string, { artistName: string; albumName: string }>();
    const touchedTracks = new Map<string, { artistName: string; trackName: string }>();

    for (let p = 0; p < maxPagesToFetch; p++) {
      this.checkCancelled();
      const pageToFetch = startPage + p;
      const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(
        username
      )}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=200&page=${pageToFetch}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch recent tracks from Last.fm page ${pageToFetch}: ${res.status}`);
      }

      const data = await res.json();
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
        // Skip live "nowplaying" scrobbles without fixed date
        if (t["@attr"]?.nowplaying === "true" || !t.date?.uts) continue;

        const uts = t.date.uts;
        const artistName = typeof t.artist === "object" ? t.artist["#text"] || t.artist.name : t.artist;
        const trackName = t.name;
        const albumName = typeof t.album === "object" ? t.album["#text"] : t.album || null;
        const mbid = t.mbid || (typeof t.artist === "object" ? t.artist.mbid : null) || null;
        const playedAtIso = new Date(parseInt(uts, 10) * 1000).toISOString();

        if (!artistName || !trackName) continue;

        // Unique Scrobble ID
        const scrobbleId = `${uts}_${artistName.trim().toLowerCase()}_${trackName.trim().toLowerCase()}`;

        const existing = await db
          .select()
          .from(lastfmScrobbles)
          .where(eq(lastfmScrobbles.id, scrobbleId))
          .limit(1);

        if (!existing[0]) {
          await db.insert(lastfmScrobbles).values({
            id: scrobbleId,
            lastfmId: uts,
            artist: artistName.trim(),
            album: albumName ? albumName.trim() : null,
            track: trackName.trim(),
            playedAt: playedAtIso,
            mbid: mbid || null,
            createdAt: now,
          });
          itemsCreated++;
          newInThisPage++;
        }

        // Track changes for aggregate updates
        touchedArtists.set(artistName.trim().toLowerCase(), { artistName: artistName.trim(), playedAt: playedAtIso });
        if (albumName && albumName.trim()) {
          const albumKey = `${artistName.trim().toLowerCase()}:::${albumName.trim().toLowerCase()}`;
          touchedAlbums.set(albumKey, { artistName: artistName.trim(), albumName: albumName.trim() });
        }
        const trackKey = `${artistName.trim().toLowerCase()}:::${trackName.trim().toLowerCase()}`;
        touchedTracks.set(trackKey, { artistName: artistName.trim(), trackName: trackName.trim() });
      }

      // In incremental mode, if we encountered 0 new tracks in page 1, we can stop early
      if (mode === "incremental" && newInThisPage === 0) {
        break;
      }
    }

    // Update aggregate Tables preserving personal metadata
    // 1. Artists
    for (const [key, info] of Array.from(touchedArtists.entries())) {
      const existingArtist = await db
        .select()
        .from(lastfmArtists)
        .where(eq(lastfmArtists.artistName, info.artistName))
        .limit(1);

      const scrobbleCountRes = await db
        .select({ count: count() })
        .from(lastfmScrobbles)
        .where(sql`LOWER(${lastfmScrobbles.artist}) = ${key}`);

      const playCount = scrobbleCountRes[0]?.count || 0;

      if (existingArtist[0]) {
        await db
          .update(lastfmArtists)
          .set({
            playCount,
            lastPlayed: info.playedAt,
            favorite: existingArtist[0].favorite,
            notes: existingArtist[0].notes,
            tags: existingArtist[0].tags,
            hidden: existingArtist[0].hidden,
            review: existingArtist[0].review,
            updatedAt: now,
          })
          .where(eq(lastfmArtists.artistName, info.artistName));
        itemsUpdated++;
      } else {
        await db.insert(lastfmArtists).values({
          artistName: info.artistName,
          playCount,
          lastPlayed: info.playedAt,
          firstPlayed: info.playedAt,
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

    // 2. Albums
    for (const [key, info] of Array.from(touchedAlbums.entries())) {
      const existingAlbum = await db.select().from(lastfmAlbums).where(eq(lastfmAlbums.id, key)).limit(1);

      const scrobbleCountRes = await db
        .select({ count: count() })
        .from(lastfmScrobbles)
        .where(
          sql`LOWER(${lastfmScrobbles.artist}) = ${info.artistName.toLowerCase()} AND LOWER(${
            lastfmScrobbles.album
          }) = ${info.albumName.toLowerCase()}`
        );

      const playCount = scrobbleCountRes[0]?.count || 0;

      if (existingAlbum[0]) {
        await db
          .update(lastfmAlbums)
          .set({
            playCount,
            favorite: existingAlbum[0].favorite,
            notes: existingAlbum[0].notes,
            tags: existingAlbum[0].tags,
            hidden: existingAlbum[0].hidden,
            review: existingAlbum[0].review,
            updatedAt: now,
          })
          .where(eq(lastfmAlbums.id, key));
        itemsUpdated++;
      } else {
        await db.insert(lastfmAlbums).values({
          id: key,
          albumName: info.albumName,
          artist: info.artistName,
          playCount,
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

    // 3. Tracks
    for (const [key, info] of Array.from(touchedTracks.entries())) {
      const existingTrack = await db.select().from(lastfmTracks).where(eq(lastfmTracks.id, key)).limit(1);

      const scrobbleCountRes = await db
        .select({ count: count() })
        .from(lastfmScrobbles)
        .where(
          sql`LOWER(${lastfmScrobbles.artist}) = ${info.artistName.toLowerCase()} AND LOWER(${
            lastfmScrobbles.track
          }) = ${info.trackName.toLowerCase()}`
        );

      const playCount = scrobbleCountRes[0]?.count || 0;

      if (existingTrack[0]) {
        await db
          .update(lastfmTracks)
          .set({
            playCount,
            favorite: existingTrack[0].favorite,
            notes: existingTrack[0].notes,
            tags: existingTrack[0].tags,
            hidden: existingTrack[0].hidden,
            review: existingTrack[0].review,
            updatedAt: now,
          })
          .where(eq(lastfmTracks.id, key));
        itemsUpdated++;
      } else {
        await db.insert(lastfmTracks).values({
          id: key,
          trackName: info.trackName,
          artist: info.artistName,
          playCount,
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

    // Advance backfill page pointer for subsequent batch imports
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

    return {
      success: true,
      itemsCreated,
      itemsUpdated,
      itemsDeleted: 0,
      metadata: {
        mode,
        pagesFetched: maxPagesToFetch,
        nextBackfillPage,
        totalPagesAvailable,
        totalScrobblesAvailable,
      },
    };
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
