import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MovieTrackerSyncProvider } from "../src/features/sync/providers/movie-tracker";
import { db, ensureDbInitialized } from "../src/db";
import { movies, shows, episodes, providers } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("MovieTrackerSyncProvider (CineTracker Integration)", () => {
  let provider: MovieTrackerSyncProvider;

  beforeEach(async () => {
    await ensureDbInitialized();
    provider = new MovieTrackerSyncProvider();
    vi.restoreAllMocks();
    await db.delete(movies).where(eq(movies.id, 77001));
    await db.delete(shows).where(eq(shows.id, 88001));
    await db.delete(episodes).where(eq(episodes.showId, 88001));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(movies).where(eq(movies.id, 77001));
    await db.delete(shows).where(eq(shows.id, 88001));
    await db.delete(episodes).where(eq(episodes.showId, 88001));
  });

  it("validates configuration correctly", async () => {
    const invalidEmpty = await provider.validateConfiguration({});
    expect(invalidEmpty.valid).toBe(false);
    expect(invalidEmpty.error).toContain("App URL");

    const invalidMissingKey = await provider.validateConfiguration({ apiUrl: "https://movie-trackerh.vercel.app" });
    expect(invalidMissingKey.valid).toBe(false);
    expect(invalidMissingKey.error).toContain("API Key");

    const valid = await provider.validateConfiguration({
      apiUrl: "https://movie-trackerh.vercel.app",
      apiKey: "cin_live_sample_token_xyz",
    });
    expect(valid.valid).toBe(true);
  });

  it("tests connection successfully against mock API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        user: { username: "cinephile", display_name: "Movie Buff" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await provider.testConnection({
      apiUrl: "https://movie-trackerh.vercel.app",
      apiKey: "cin_live_valid_key",
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://movie-trackerh.vercel.app/api/v1/export?include=profile",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer cin_live_valid_key",
        }),
      })
    );
  });

  it("handles 401 unauthorized and 429 rate limit during connection test", async () => {
    const mockFetch401 = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch401);

    await expect(
      provider.testConnection({
        apiUrl: "https://movie-trackerh.vercel.app",
        apiKey: "cin_live_bad_key",
      })
    ).rejects.toThrow("401 Unauthorized");

    const mockFetch429 = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });
    vi.stubGlobal("fetch", mockFetch429);

    await expect(
      provider.testConnection({
        apiUrl: "https://movie-trackerh.vercel.app",
        apiKey: "cin_live_bad_key",
      })
    ).rejects.toThrow("429 Too Many Requests");
  });

  it("syncs movies, TV shows, and episodes with 1-10 rating and platform tags", async () => {
    const testMovieId = 77001;
    const testShowId = 88001;

    const mockExportPayload = {
      status: "success",
      movies: [
        {
          log_id: 1,
          movie_id: testMovieId,
          title: "Inception Test",
          overview: "A thief enters the dreams of others.",
          release_date: "2010-07-16",
          poster_path: "/inception.jpg",
          backdrop_path: "/inception_back.jpg",
          runtime_minutes: 148,
          tmdb_vote_average: 8.4,
          user_rating: 10,
          user_review: "Masterpiece by Christopher Nolan!",
          watched_date: "2026-05-20",
          created_at: "2026-05-20T12:00:00Z",
          updated_at: "2026-05-20T12:00:00Z",
        },
      ],
      tv_shows: [
        {
          log_id: 10,
          tv_show_id: testShowId,
          name: "Severance Test",
          overview: "Work-life balance taken to the extreme.",
          first_air_date: "2022-02-18",
          poster_path: "/severance.jpg",
          backdrop_path: "/severance_back.jpg",
          number_of_seasons: 2,
          number_of_episodes: 19,
          tmdb_vote_average: 8.5,
          user_rating: 9,
          user_review: "Defiant Jazz!",
          is_favorite: true,
          watched_where: ["Apple TV+", "Pirated"],
          created_at: "2026-05-21T12:00:00Z",
          updated_at: "2026-05-21T12:00:00Z",
        },
      ],
      episodes: [
        {
          log_id: 101,
          tv_show_id: testShowId,
          tv_show_name: "Severance Test",
          season_number: 1,
          episode_number: 1,
          episode_name: "Good News About Hell",
          overview: "Mark Scout leads a team.",
          still_path: "/ep1.jpg",
          watched: true,
          watched_date: "2026-05-21",
          user_rating: 9,
          created_at: "2026-05-21T12:00:00Z",
          updated_at: "2026-05-21T12:00:00Z",
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockExportPayload,
    });
    vi.stubGlobal("fetch", mockFetch);

    // Save initial provider record in DB
    await db
      .insert(providers)
      .values({
        id: "prov_movie_tracker",
        slug: "movie_tracker",
        name: "Movie Tracker",
        status: "connected",
        enabled: 1,
        connected: 1,
        configurationJson: JSON.stringify({ apiUrl: "https://movie-trackerh.vercel.app", apiKey: "cin_live_key" }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    const syncResult = await provider.sync({ mode: "full" });
    expect(syncResult.success).toBe(true);
    expect(syncResult.itemsCreated).toBeGreaterThanOrEqual(3);

    // Verify Movie in DB
    const movieRecord = await db.select().from(movies).where(eq(movies.id, testMovieId)).limit(1);
    expect(movieRecord.length).toBe(1);
    expect(movieRecord[0].title).toBe("Inception Test");
    expect(movieRecord[0].rating).toBe(10);
    expect(movieRecord[0].review).toBe("Masterpiece by Christopher Nolan!");
    expect(movieRecord[0].year).toBe(2010);
    expect(movieRecord[0].runtime).toBe(148);

    // Verify TV Show in DB
    const showRecord = await db.select().from(shows).where(eq(shows.id, testShowId)).limit(1);
    expect(showRecord.length).toBe(1);
    expect(showRecord[0].title).toBe("Severance Test");
    expect(showRecord[0].favorite).toBe(1);
    expect(showRecord[0].review).toBe("Defiant Jazz!");
    expect(JSON.parse(showRecord[0].customTags)).toEqual(["Apple TV+", "Pirated"]);

    // Verify Episode in DB
    const epRecord = await db.select().from(episodes).where(eq(episodes.id, `${testShowId}_s1_e1`)).limit(1);
    expect(epRecord.length).toBe(1);
    expect(epRecord[0].title).toBe("Good News About Hell");
    expect(epRecord[0].rating).toBe(9);

    // Verify getStatistics returns updated counts
    const stats = await provider.getStatistics();
    expect(Number(stats["Movies Watched"])).toBeGreaterThanOrEqual(1);
    expect(Number(stats["TV Shows"])).toBeGreaterThanOrEqual(1);
    expect(Number(stats["Episodes"])).toBeGreaterThanOrEqual(1);
  });
});
