"use server";

import { ensureDbInitialized, db } from "@/db";
import {
  lastfmArtists,
  lastfmAlbums,
  lastfmTracks,
  lastfmScrobbles,
  artistMetadata,
  albumMetadata,
  trackMetadata,
  ArtistMetadataRecord,
  AlbumMetadataRecord,
  TrackMetadataRecord,
  LastfmScrobbleRecord,
  LastfmArtistRecord,
  LastfmAlbumRecord,
  LastfmTrackRecord,
} from "@/db/schema";
import { CombinedArtist, CombinedAlbum, CombinedTrack, MusicFilterOptions } from "../types";
import { getItemCollectionsAction } from "./collections";
import { recordActivityAction } from "./activities";
import { eq, like, desc, asc, sql } from "drizzle-orm";
import { revalidatePath, unstable_cache, revalidateTag } from "next/cache";

import { PaginatedResult } from "../types";

async function fetchArtistsFromDb(options?: MusicFilterOptions): Promise<PaginatedResult<CombinedArtist>> {
  await ensureDbInitialized();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);

  const artistsList = await db.select({
    artistName: lastfmArtists.artistName,
    playCount: lastfmArtists.playCount,
    lastPlayed: lastfmArtists.lastPlayed,
    firstPlayed: lastfmArtists.firstPlayed,
    favorite: lastfmArtists.favorite,
    notes: lastfmArtists.notes,
    tags: lastfmArtists.tags,
    hidden: lastfmArtists.hidden,
    updatedAt: lastfmArtists.updatedAt,
  }).from(lastfmArtists);

  const metadataList = await db.select({
    artistName: artistMetadata.artistName,
    favorite: artistMetadata.favorite,
    personalRating: artistMetadata.personalRating,
    review: artistMetadata.review,
    notes: artistMetadata.notes,
    tags: artistMetadata.tags,
    visibility: artistMetadata.visibility,
    hidden: artistMetadata.hidden,
    createdAt: artistMetadata.createdAt,
    updatedAt: artistMetadata.updatedAt,
  }).from(artistMetadata);

  const metadataMap = new Map<string, any>();
  metadataList.forEach((m) => metadataMap.set(m.artistName.toLowerCase(), m));

  let combined: CombinedArtist[] = [];
  for (const a of artistsList) {
    const meta = metadataMap.get(a.artistName.toLowerCase()) || null;
    combined.push({
      artist: a as LastfmArtistRecord,
      metadata: meta as ArtistMetadataRecord,
      collections: [],
    });
  }

  if (options) {
    if (options.query) {
      const q = options.query.toLowerCase().trim();
      combined = combined.filter(
        (c) =>
          c.artist.artistName.toLowerCase().includes(q) ||
          c.metadata?.notes?.toLowerCase().includes(q) ||
          c.metadata?.review?.toLowerCase().includes(q)
      );
    }

    if (options.favorite) {
      combined = combined.filter((c) => c.metadata?.favorite === 1 || c.artist.favorite === 1);
    }

    const sortBy = options.sortBy || "play_count";
    const order = options.sortOrder || "desc";

    combined.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortBy === "play_count") {
        valA = a.artist.playCount || 0;
        valB = b.artist.playCount || 0;
      } else if (sortBy === "name") {
        valA = a.artist.artistName.toLowerCase();
        valB = b.artist.artistName.toLowerCase();
      } else if (sortBy === "last_played") {
        valA = a.artist.lastPlayed || "";
        valB = b.artist.lastPlayed || "";
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }

  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;

  return {
    items: combined.slice(startIndex, startIndex + limit),
    total,
    page,
    limit,
    totalPages,
  };
}

import { createCachedQuery, purgeTag } from "@/lib/server-cache";

const getCachedPaginatedArtists = createCachedQuery(
  async (optionsJson: string) => {
    const options = JSON.parse(optionsJson);
    return fetchArtistsFromDb(options);
  },
  ["music-artists-list-query"],
  {
    revalidate: 3600,
    tags: ["music-artists"],
  }
);

export async function getPaginatedArtistsAction(options?: MusicFilterOptions): Promise<PaginatedResult<CombinedArtist>> {
  return getCachedPaginatedArtists(JSON.stringify(options || {}));
}

// --- ARTISTS ---
export async function getArtistsAction(options?: MusicFilterOptions): Promise<CombinedArtist[]> {
  const res = await getPaginatedArtistsAction({ ...options, limit: 1000 });
  return res.items;
}

export async function getArtistDetailAction(artistName: string): Promise<CombinedArtist | null> {
  await ensureDbInitialized();

  const artistRes = await db.select().from(lastfmArtists).where(eq(lastfmArtists.artistName, artistName)).limit(1);
  if (!artistRes[0]) return null;

  const metadataRes = await db.select().from(artistMetadata).where(eq(artistMetadata.artistName, artistName)).limit(1);
  const collections = await getItemCollectionsAction("artist", artistName);

  return {
    artist: artistRes[0],
    metadata: metadataRes[0] || null,
    collections,
  };
}

export async function updateArtistMetadataAction(
  artistName: string,
  data: {
    favorite?: boolean;
    personalRating?: number | null;
    review?: string | null;
    notes?: string | null;
    tags?: string[];
    visibility?: string;
    hidden?: boolean;
    relatedMicroblogs?: string[];
    relatedBlogPosts?: string[];
    relatedPhotos?: string[];
  }
) {
  await ensureDbInitialized();
  const now = new Date().toISOString();
  const existing = await db.select().from(artistMetadata).where(eq(artistMetadata.artistName, artistName)).limit(1);

  const updateValues: any = {
    updatedAt: now,
  };

  if (data.favorite !== undefined) updateValues.favorite = data.favorite ? 1 : 0;
  if (data.personalRating !== undefined) updateValues.personalRating = data.personalRating;
  if (data.review !== undefined) updateValues.review = data.review;
  if (data.notes !== undefined) updateValues.notes = data.notes;
  if (data.tags !== undefined) updateValues.tags = JSON.stringify(data.tags);
  if (data.visibility !== undefined) updateValues.visibility = data.visibility;
  if (data.hidden !== undefined) updateValues.hidden = data.hidden ? 1 : 0;
  if (data.relatedMicroblogs !== undefined) updateValues.relatedMicroblogs = JSON.stringify(data.relatedMicroblogs);
  if (data.relatedBlogPosts !== undefined) updateValues.relatedBlogPosts = JSON.stringify(data.relatedBlogPosts);
  if (data.relatedPhotos !== undefined) updateValues.relatedPhotos = JSON.stringify(data.relatedPhotos);

  if (existing[0]) {
    await db.update(artistMetadata).set(updateValues).where(eq(artistMetadata.artistName, artistName));
  } else {
    await db.insert(artistMetadata).values({
      artistName,
      favorite: data.favorite ? 1 : 0,
      personalRating: data.personalRating || null,
      review: data.review || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      visibility: data.visibility || "public",
      hidden: data.hidden ? 1 : 0,
      relatedMicroblogs: JSON.stringify(data.relatedMicroblogs || []),
      relatedBlogPosts: JSON.stringify(data.relatedBlogPosts || []),
      relatedPhotos: JSON.stringify(data.relatedPhotos || []),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (data.favorite) {
    await recordActivityAction("artist_favorited", "artist", artistName, `Favorited Artist: ${artistName}`);
  }

  try {
    purgeTag("music-artists");
    revalidatePath(`/libraries/music`);
    revalidatePath(`/libraries/music/artists/${encodeURIComponent(artistName)}`);
  } catch {}
  return { success: true };
}

async function fetchAlbumsFromDb(options?: MusicFilterOptions): Promise<PaginatedResult<CombinedAlbum>> {
  await ensureDbInitialized();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);

  const albumsList = await db.select({
    id: lastfmAlbums.id,
    albumName: lastfmAlbums.albumName,
    artist: lastfmAlbums.artist,
    playCount: lastfmAlbums.playCount,
    favorite: lastfmAlbums.favorite,
    notes: lastfmAlbums.notes,
    tags: lastfmAlbums.tags,
    hidden: lastfmAlbums.hidden,
    updatedAt: lastfmAlbums.updatedAt,
  }).from(lastfmAlbums);

  const metadataList = await db.select({
    id: albumMetadata.id,
    favorite: albumMetadata.favorite,
    personalRating: albumMetadata.personalRating,
    review: albumMetadata.review,
    notes: albumMetadata.notes,
    tags: albumMetadata.tags,
    visibility: albumMetadata.visibility,
    createdAt: albumMetadata.createdAt,
    updatedAt: albumMetadata.updatedAt,
  }).from(albumMetadata);

  const metadataMap = new Map<string, any>();
  metadataList.forEach((m) => metadataMap.set(m.id, m));

  let combined: CombinedAlbum[] = [];
  for (const alb of albumsList) {
    const meta = metadataMap.get(alb.id) || null;
    combined.push({
      album: alb as LastfmAlbumRecord,
      metadata: meta as AlbumMetadataRecord,
      collections: [],
    });
  }

  if (options) {
    if (options.query) {
      const q = options.query.toLowerCase().trim();
      combined = combined.filter(
        (c) =>
          c.album.albumName.toLowerCase().includes(q) ||
          c.album.artist.toLowerCase().includes(q) ||
          c.metadata?.notes?.toLowerCase().includes(q)
      );
    }

    if (options.favorite) {
      combined = combined.filter((c) => c.metadata?.favorite === 1 || c.album.favorite === 1);
    }

    const sortBy = options.sortBy || "play_count";
    const order = options.sortOrder || "desc";

    combined.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortBy === "play_count") {
        valA = a.album.playCount || 0;
        valB = b.album.playCount || 0;
      } else if (sortBy === "name") {
        valA = a.album.albumName.toLowerCase();
        valB = b.album.albumName.toLowerCase();
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }

  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;

  return {
    items: combined.slice(startIndex, startIndex + limit),
    total,
    page,
    limit,
    totalPages,
  };
}

const getCachedPaginatedAlbums = createCachedQuery(
  async (optionsJson: string) => {
    const options = JSON.parse(optionsJson);
    return fetchAlbumsFromDb(options);
  },
  ["music-albums-list-query"],
  {
    revalidate: 3600,
    tags: ["music-albums"],
  }
);

export async function getPaginatedAlbumsAction(options?: MusicFilterOptions): Promise<PaginatedResult<CombinedAlbum>> {
  return getCachedPaginatedAlbums(JSON.stringify(options || {}));
}

// --- ALBUMS ---
export async function getAlbumsAction(options?: MusicFilterOptions): Promise<CombinedAlbum[]> {
  const res = await getPaginatedAlbumsAction({ ...options, limit: 1000 });
  return res.items;
}

export async function getAlbumDetailAction(id: string): Promise<CombinedAlbum | null> {
  await ensureDbInitialized();

  const albumRes = await db.select().from(lastfmAlbums).where(eq(lastfmAlbums.id, id)).limit(1);
  if (!albumRes[0]) return null;

  const metadataRes = await db.select().from(albumMetadata).where(eq(albumMetadata.id, id)).limit(1);
  const collections = await getItemCollectionsAction("album", id);

  return {
    album: albumRes[0],
    metadata: metadataRes[0] || null,
    collections,
  };
}

export async function updateAlbumMetadataAction(
  id: string,
  data: {
    favorite?: boolean;
    personalRating?: number | null;
    review?: string | null;
    notes?: string | null;
    tags?: string[];
    visibility?: string;
  }
) {
  await ensureDbInitialized();
  const now = new Date().toISOString();
  const existing = await db.select().from(albumMetadata).where(eq(albumMetadata.id, id)).limit(1);

  const updateValues: any = {
    updatedAt: now,
  };

  if (data.favorite !== undefined) updateValues.favorite = data.favorite ? 1 : 0;
  if (data.personalRating !== undefined) updateValues.personalRating = data.personalRating;
  if (data.review !== undefined) updateValues.review = data.review;
  if (data.notes !== undefined) updateValues.notes = data.notes;
  if (data.tags !== undefined) updateValues.tags = JSON.stringify(data.tags);
  if (data.visibility !== undefined) updateValues.visibility = data.visibility;

  if (existing[0]) {
    await db.update(albumMetadata).set(updateValues).where(eq(albumMetadata.id, id));
  } else {
    await db.insert(albumMetadata).values({
      id,
      favorite: data.favorite ? 1 : 0,
      personalRating: data.personalRating || null,
      review: data.review || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      visibility: data.visibility || "public",
      createdAt: now,
      updatedAt: now,
    });
  }

  if (data.favorite) {
    await recordActivityAction("album_favorited", "album", id, `Favorited Album: ${id.replace(":::", " - ")}`);
  }

  purgeTag("music-albums");
  revalidatePath(`/libraries/music`);
  return { success: true };
}

async function fetchTracksFromDb(options?: MusicFilterOptions): Promise<PaginatedResult<CombinedTrack>> {
  await ensureDbInitialized();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);

  const tracksList = await db.select({
    id: lastfmTracks.id,
    trackName: lastfmTracks.trackName,
    artist: lastfmTracks.artist,
    playCount: lastfmTracks.playCount,
    favorite: lastfmTracks.favorite,
    notes: lastfmTracks.notes,
    tags: lastfmTracks.tags,
    hidden: lastfmTracks.hidden,
    updatedAt: lastfmTracks.updatedAt,
  }).from(lastfmTracks);

  const metadataList = await db.select({
    id: trackMetadata.id,
    favorite: trackMetadata.favorite,
    loved: trackMetadata.loved,
    personalRating: trackMetadata.personalRating,
    notes: trackMetadata.notes,
    tags: trackMetadata.tags,
    visibility: trackMetadata.visibility,
    createdAt: trackMetadata.createdAt,
    updatedAt: trackMetadata.updatedAt,
  }).from(trackMetadata);

  const metadataMap = new Map<string, any>();
  metadataList.forEach((m) => metadataMap.set(m.id, m));

  let combined: CombinedTrack[] = [];
  for (const tr of tracksList) {
    const meta = metadataMap.get(tr.id) || null;
    combined.push({
      track: tr as LastfmTrackRecord,
      metadata: meta as TrackMetadataRecord,
      collections: [],
    });
  }

  if (options) {
    if (options.query) {
      const q = options.query.toLowerCase().trim();
      combined = combined.filter(
        (c) =>
          c.track.trackName.toLowerCase().includes(q) ||
          c.track.artist.toLowerCase().includes(q) ||
          c.metadata?.notes?.toLowerCase().includes(q)
      );
    }

    if (options.favorite) {
      combined = combined.filter((c) => c.metadata?.favorite === 1 || c.metadata?.loved === 1 || c.track.favorite === 1);
    }

    const sortBy = options.sortBy || "play_count";
    const order = options.sortOrder || "desc";

    combined.sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      if (sortBy === "play_count") {
        valA = a.track.playCount || 0;
        valB = b.track.playCount || 0;
      } else if (sortBy === "name") {
        valA = a.track.trackName.toLowerCase();
        valB = b.track.trackName.toLowerCase();
      }

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });
  }

  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;

  return {
    items: combined.slice(startIndex, startIndex + limit),
    total,
    page,
    limit,
    totalPages,
  };
}

const getCachedPaginatedTracks = createCachedQuery(
  async (optionsJson: string) => {
    const options = JSON.parse(optionsJson);
    return fetchTracksFromDb(options);
  },
  ["music-tracks-list-query"],
  {
    revalidate: 3600,
    tags: ["music-tracks"],
  }
);

export async function getPaginatedTracksAction(options?: MusicFilterOptions): Promise<PaginatedResult<CombinedTrack>> {
  return getCachedPaginatedTracks(JSON.stringify(options || {}));
}

// --- TRACKS ---
export async function getTracksAction(options?: MusicFilterOptions): Promise<CombinedTrack[]> {
  const res = await getPaginatedTracksAction({ ...options, limit: 1000 });
  return res.items;
}

export async function getTrackDetailAction(id: string): Promise<CombinedTrack | null> {
  await ensureDbInitialized();

  const trackRes = await db.select().from(lastfmTracks).where(eq(lastfmTracks.id, id)).limit(1);
  if (!trackRes[0]) return null;

  const metadataRes = await db.select().from(trackMetadata).where(eq(trackMetadata.id, id)).limit(1);
  const collections = await getItemCollectionsAction("track", id);

  return {
    track: trackRes[0],
    metadata: metadataRes[0] || null,
    collections,
  };
}

export async function updateTrackMetadataAction(
  id: string,
  data: {
    favorite?: boolean;
    loved?: boolean;
    personalRating?: number | null;
    notes?: string | null;
    tags?: string[];
    visibility?: string;
  }
) {
  await ensureDbInitialized();
  const now = new Date().toISOString();
  const existing = await db.select().from(trackMetadata).where(eq(trackMetadata.id, id)).limit(1);

  const updateValues: any = {
    updatedAt: now,
  };

  if (data.favorite !== undefined) updateValues.favorite = data.favorite ? 1 : 0;
  if (data.loved !== undefined) updateValues.loved = data.loved ? 1 : 0;
  if (data.personalRating !== undefined) updateValues.personalRating = data.personalRating;
  if (data.notes !== undefined) updateValues.notes = data.notes;
  if (data.tags !== undefined) updateValues.tags = JSON.stringify(data.tags);
  if (data.visibility !== undefined) updateValues.visibility = data.visibility;

  if (existing[0]) {
    await db.update(trackMetadata).set(updateValues).where(eq(trackMetadata.id, id));
  } else {
    await db.insert(trackMetadata).values({
      id,
      favorite: data.favorite ? 1 : 0,
      loved: data.loved ? 1 : 0,
      personalRating: data.personalRating || null,
      notes: data.notes || null,
      tags: JSON.stringify(data.tags || []),
      visibility: data.visibility || "public",
      createdAt: now,
      updatedAt: now,
    });
  }

  if (data.loved) {
    await recordActivityAction("track_loved", "track", id, `Loved Track: ${id.replace(":::", " - ")}`);
  }

  purgeTag("music-tracks");
  revalidatePath(`/libraries/music`);
  return { success: true };
}

async function fetchHistoryFromDb(options?: {
  timeframe?: "all" | "today" | "yesterday" | "this_week" | "this_month";
  query?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<LastfmScrobbleRecord>> {
  await ensureDbInitialized();
  const page = Math.max(1, options?.page || 1);
  const limit = Math.max(1, options?.limit || 25);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (options?.query && options.query.trim()) {
    const q = `%${options.query.trim()}%`;
    conditions.push(sql`(${lastfmScrobbles.track} LIKE ${q} OR ${lastfmScrobbles.artist} LIKE ${q} OR ${lastfmScrobbles.album} LIKE ${q})`);
  }

  const whereClause = conditions.length > 0 ? conditions[0] : undefined;

  const selectColumns = {
    id: lastfmScrobbles.id,
    lastfmId: lastfmScrobbles.lastfmId,
    artist: lastfmScrobbles.artist,
    album: lastfmScrobbles.album,
    track: lastfmScrobbles.track,
    playedAt: lastfmScrobbles.playedAt,
    duration: lastfmScrobbles.duration,
    mbid: lastfmScrobbles.mbid,
    createdAt: lastfmScrobbles.createdAt,
  };

  const [totals, items] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(lastfmScrobbles).where(whereClause),
    db.select(selectColumns).from(lastfmScrobbles).where(whereClause).orderBy(desc(lastfmScrobbles.playedAt)).limit(limit).offset(offset),
  ]);

  const total = totals[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items,
    total,
    page,
    limit,
    totalPages,
  };
}

const getCachedPaginatedHistory = createCachedQuery(
  async (optionsJson: string) => {
    const options = JSON.parse(optionsJson);
    return fetchHistoryFromDb(options);
  },
  ["music-history-list-query"],
  {
    revalidate: 3600,
    tags: ["music-history"],
  }
);

export async function getPaginatedHistoryAction(options?: {
  timeframe?: "all" | "today" | "yesterday" | "this_week" | "this_month";
  query?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<LastfmScrobbleRecord>> {
  return getCachedPaginatedHistory(JSON.stringify(options || {}));
}

// --- LISTENING HISTORY ---
export async function getListeningHistoryAction(options?: {
  timeframe?: "all" | "today" | "yesterday" | "this_week" | "this_month";
  query?: string;
  limit?: number;
}): Promise<LastfmScrobbleRecord[]> {
  const res = await getPaginatedHistoryAction({
    query: options?.query,
    limit: options?.limit || 100,
    page: 1,
  });
  return res.items;
}
