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
} from "@/db/schema";
import { CombinedArtist, CombinedAlbum, CombinedTrack, MusicFilterOptions } from "../types";
import { getItemCollectionsAction } from "./collections";
import { recordActivityAction } from "./activities";
import { eq, like, desc, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- ARTISTS ---
export async function getArtistsAction(options?: MusicFilterOptions): Promise<CombinedArtist[]> {
  await ensureDbInitialized();

  const artistsList = await db.select().from(lastfmArtists);
  const metadataList = await db.select().from(artistMetadata);
  const metadataMap = new Map<string, ArtistMetadataRecord>();
  metadataList.forEach((m) => metadataMap.set(m.artistName.toLowerCase(), m));

  let combined: CombinedArtist[] = [];

  for (const a of artistsList) {
    const meta = metadataMap.get(a.artistName.toLowerCase()) || null;
    combined.push({
      artist: a,
      metadata: meta,
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
      combined = combined.filter((c) => c.metadata?.favorite === 1);
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

  return combined;
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
    revalidatePath(`/libraries/music`);
    revalidatePath(`/libraries/music/artists/${encodeURIComponent(artistName)}`);
  } catch {}
  return { success: true };
}

// --- ALBUMS ---
export async function getAlbumsAction(options?: MusicFilterOptions): Promise<CombinedAlbum[]> {
  await ensureDbInitialized();

  const albumsList = await db.select().from(lastfmAlbums);
  const metadataList = await db.select().from(albumMetadata);
  const metadataMap = new Map<string, AlbumMetadataRecord>();
  metadataList.forEach((m) => metadataMap.set(m.id, m));

  let combined: CombinedAlbum[] = [];

  for (const alb of albumsList) {
    const meta = metadataMap.get(alb.id) || null;
    combined.push({
      album: alb,
      metadata: meta,
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
      combined = combined.filter((c) => c.metadata?.favorite === 1);
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

  return combined;
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

  revalidatePath(`/libraries/music`);
  return { success: true };
}

// --- TRACKS ---
export async function getTracksAction(options?: MusicFilterOptions): Promise<CombinedTrack[]> {
  await ensureDbInitialized();

  const tracksList = await db.select().from(lastfmTracks);
  const metadataList = await db.select().from(trackMetadata);
  const metadataMap = new Map<string, TrackMetadataRecord>();
  metadataList.forEach((m) => metadataMap.set(m.id, m));

  let combined: CombinedTrack[] = [];

  for (const tr of tracksList) {
    const meta = metadataMap.get(tr.id) || null;
    combined.push({
      track: tr,
      metadata: meta,
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
      combined = combined.filter((c) => c.metadata?.favorite === 1 || c.metadata?.loved === 1);
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

  return combined;
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

  revalidatePath(`/libraries/music`);
  return { success: true };
}

// --- LISTENING HISTORY ---
export async function getListeningHistoryAction(options?: {
  timeframe?: "all" | "today" | "yesterday" | "this_week" | "this_month";
  query?: string;
  limit?: number;
}): Promise<LastfmScrobbleRecord[]> {
  await ensureDbInitialized();

  let list = await db.select().from(lastfmScrobbles).orderBy(desc(lastfmScrobbles.playedAt)).limit(options?.limit || 100);

  if (options) {
    if (options.query) {
      const q = options.query.toLowerCase().trim();
      list = list.filter((s) => s.track.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.album?.toLowerCase().includes(q));
    }

    if (options.timeframe && options.timeframe !== "all") {
      const now = new Date();
      if (options.timeframe === "today") {
        const todayStr = now.toISOString().slice(0, 10);
        list = list.filter((s) => s.playedAt.startsWith(todayStr));
      } else if (options.timeframe === "yesterday") {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        const yestStr = yest.toISOString().slice(0, 10);
        list = list.filter((s) => s.playedAt.startsWith(yestStr));
      } else if (options.timeframe === "this_week") {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const startStr = startOfWeek.toISOString().slice(0, 10);
        list = list.filter((s) => s.playedAt >= startStr);
      } else if (options.timeframe === "this_month") {
        const monthStr = now.toISOString().slice(0, 7);
        list = list.filter((s) => s.playedAt.startsWith(monthStr));
      }
    }
  }

  return list;
}
