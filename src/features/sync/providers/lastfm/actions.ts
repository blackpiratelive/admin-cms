"use server";

import { ensureDbInitialized, db } from "@/db";
import { lastfmArtists, lastfmAlbums, lastfmTracks, lastfmScrobbles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function calculateLastFmPlayedDatesAction(onProgress?: (msg: string) => void) {
  await ensureDbInitialized();

  // 1. Calculate Artists dates & stats
  onProgress?.("Calculating first and last played dates for Artists from scrobbles...");
  const artistStats = await db.all<{ artist_name: string; first_played: string; last_played: string; scrobble_count: number }>(sql`
    SELECT 
      artist as artist_name, 
      MIN(played_at) as first_played, 
      MAX(played_at) as last_played,
      COUNT(*) as scrobble_count
    FROM lastfm_scrobbles 
    GROUP BY LOWER(artist)
  `);

  let updatedArtists = 0;
  for (const stat of artistStats) {
    if (!stat.artist_name) continue;
    const existing = await db
      .select()
      .from(lastfmArtists)
      .where(sql`LOWER(${lastfmArtists.artistName}) = ${stat.artist_name.toLowerCase()}`)
      .limit(1);

    if (existing[0]) {
      await db
        .update(lastfmArtists)
        .set({
          firstPlayed: stat.first_played,
          lastPlayed: stat.last_played,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(lastfmArtists.artistName, existing[0].artistName));
      updatedArtists++;
    }
  }
  onProgress?.(`Updated first/last played dates for ${updatedArtists} artists.`);

  // 2. Calculate Albums dates & stats
  onProgress?.("Calculating first and last played dates for Albums from scrobbles...");
  const albumStats = await db.all<{ artist: string; album: string; first_played: string; last_played: string }>(sql`
    SELECT 
      artist, 
      album, 
      MIN(played_at) as first_played, 
      MAX(played_at) as last_played
    FROM lastfm_scrobbles 
    WHERE album IS NOT NULL AND album != ''
    GROUP BY LOWER(artist), LOWER(album)
  `);

  let updatedAlbums = 0;
  for (const stat of albumStats) {
    if (!stat.artist || !stat.album) continue;
    const albumId = `${stat.artist.trim().toLowerCase()}:::${stat.album.trim().toLowerCase()}`;
    const existing = await db.select().from(lastfmAlbums).where(eq(lastfmAlbums.id, albumId)).limit(1);

    if (existing[0]) {
      await db
        .update(lastfmAlbums)
        .set({
          firstPlayed: stat.first_played,
          lastPlayed: stat.last_played,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(lastfmAlbums.id, albumId));
      updatedAlbums++;
    }
  }
  onProgress?.(`Updated first/last played dates for ${updatedAlbums} albums.`);

  // 3. Calculate Tracks dates & stats
  onProgress?.("Calculating first and last played dates for Tracks from scrobbles...");
  const trackStats = await db.all<{ artist: string; track: string; first_played: string; last_played: string }>(sql`
    SELECT 
      artist, 
      track, 
      MIN(played_at) as first_played, 
      MAX(played_at) as last_played
    FROM lastfm_scrobbles 
    GROUP BY LOWER(artist), LOWER(track)
  `);

  let updatedTracks = 0;
  for (const stat of trackStats) {
    if (!stat.artist || !stat.track) continue;
    const trackId = `${stat.artist.trim().toLowerCase()}:::${stat.track.trim().toLowerCase()}`;
    const existing = await db.select().from(lastfmTracks).where(eq(lastfmTracks.id, trackId)).limit(1);

    if (existing[0]) {
      await db
        .update(lastfmTracks)
        .set({
          firstPlayed: stat.first_played,
          lastPlayed: stat.last_played,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(lastfmTracks.id, trackId));
      updatedTracks++;
    }
  }
  onProgress?.(`Updated first/last played dates for ${updatedTracks} tracks.`);

  revalidatePath("/libraries/music");
  revalidatePath("/sync");

  return {
    success: true,
    updatedArtists,
    updatedAlbums,
    updatedTracks,
  };
}
