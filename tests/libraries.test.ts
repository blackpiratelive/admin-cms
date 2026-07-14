import { describe, it, expect, beforeAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { traktMovies, traktShows, lastfmArtists, lastfmScrobbles } from "../src/db/schema";
import { getMoviesAction, updateMovieMetadataAction, getMovieDetailAction } from "../src/features/libraries/actions/movies";
import { getShowsAction, updateShowMetadataAction, getShowDetailAction } from "../src/features/libraries/actions/shows";
import { getArtistsAction, updateArtistMetadataAction, getListeningHistoryAction } from "../src/features/libraries/actions/music";
import { createCollectionAction, getCollectionsAction, addItemToCollectionAction, getItemCollectionsAction } from "../src/features/libraries/actions/collections";
import { getActivitiesAction } from "../src/features/libraries/actions/activities";
import { globalSearchAction } from "../src/features/libraries/actions/search";

describe("Personal Libraries System", () => {
  beforeAll(async () => {
    await ensureDbInitialized();

    const now = new Date().toISOString();

    // Insert dummy Trakt Movie
    await db.insert(traktMovies).values({
      traktId: 99991,
      tmdbId: 550,
      title: "Interstellar Test",
      year: 2014,
      overview: "Space exploration masterpiece",
      runtime: 169,
      rating: 8.9,
      watchedAt: now,
      genres: JSON.stringify(["Sci-Fi", "Drama"]),
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Insert dummy Trakt TV Show
    await db.insert(traktShows).values({
      traktId: 88881,
      tmdbId: 1399,
      title: "Breaking Bad Test",
      year: 2008,
      status: "Ended",
      overview: "Chemistry teacher turns kingpin",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Insert dummy Last.fm Artist
    await db.insert(lastfmArtists).values({
      artistName: "Radiohead Test",
      playCount: 1500,
      lastPlayed: now,
      firstPlayed: now,
      updatedAt: now,
    }).onConflictDoNothing();

    // Insert dummy Last.fm Scrobble
    await db.insert(lastfmScrobbles).values({
      id: "scrobble_999",
      artist: "Radiohead Test",
      track: "Karma Police Test",
      playedAt: now,
      createdAt: now,
    }).onConflictDoNothing();
  });

  it("should fetch movie list and allow editing personal metadata", async () => {
    const movies = await getMoviesAction({ query: "Interstellar" });
    expect(movies.length).toBeGreaterThan(0);
    expect(movies[0].movie.title).toBe("Interstellar Test");

    // Update metadata
    await updateMovieMetadataAction(99991, {
      favorite: true,
      personalRating: 10,
      review: "Absolute cinema masterpiece!",
      tags: ["space", "fav-2014"],
    });

    const detail = await getMovieDetailAction(99991);
    expect(detail).not.toBeNull();
    expect(detail?.metadata?.favorite).toBe(1);
    expect(detail?.metadata?.personalRating).toBe(10);
    expect(detail?.metadata?.review).toBe("Absolute cinema masterpiece!");
  });

  it("should support TV Show metadata and detail view", async () => {
    await updateShowMetadataAction(88881, {
      favorite: true,
      personalRating: 9.5,
      notes: "Must rewatch season 5",
    });

    const detail = await getShowDetailAction(88881);
    expect(detail?.metadata?.favorite).toBe(1);
    expect(detail?.metadata?.notes).toBe("Must rewatch season 5");
  });

  it("should support Music Artist metadata editing and history", async () => {
    await updateArtistMetadataAction("Radiohead Test", {
      favorite: true,
      tags: ["alt-rock", "legendary"],
    });

    const history = await getListeningHistoryAction();
    expect(history.some((h) => h.artist === "Radiohead Test")).toBe(true);
  });

  it("should manage Generic Collections and items", async () => {
    const col = await createCollectionAction("Sci-Fi Masterpieces", "Best sci fi movies");
    expect(col.success).toBe(true);

    await addItemToCollectionAction(col.id, "movie", 99991);

    const itemCols = await getItemCollectionsAction("movie", 99991);
    expect(itemCols.some((c) => c.name === "Sci-Fi Masterpieces")).toBe(true);
  });

  it("should record activities and perform global fuzzy search", async () => {
    const activities = await getActivitiesAction();
    expect(activities.length).toBeGreaterThan(0);

    const searchRes = await globalSearchAction("Interstellar");
    expect(searchRes.movies.length).toBeGreaterThan(0);
    expect(searchRes.movies[0].movie.title).toBe("Interstellar Test");
  });
});
