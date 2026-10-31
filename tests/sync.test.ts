import { describe, it, expect, beforeEach } from "vitest";
import { syncRegistry } from "../src/features/sync/registry";
import { MovieTrackerSyncProvider } from "../src/features/sync/providers/movie-tracker";
import { LastfmSyncProvider } from "../src/features/sync/providers/lastfm";
import { BlueskySyncProvider } from "../src/features/sync/providers/bluesky";
import { MastodonSyncProvider } from "../src/features/sync/providers/mastodon";
import { FreshRSSSyncProvider } from "../src/features/sync/providers/freshrss";
import { ensureDbInitialized, db } from "../src/db";
import { providers, syncLogs } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Sync Center Provider Registry & Architecture", () => {
  beforeEach(async () => {
    await ensureDbInitialized();
  });

  it("should discover registered providers", () => {
    const allProviders = syncRegistry.getAllProviders();
    expect(allProviders.length).toBeGreaterThanOrEqual(5);

    const movieTracker = syncRegistry.getProvider("movie_tracker");
    expect(movieTracker).toBeDefined();
    expect(movieTracker?.name).toBe("Movie Tracker");

    const freshrss = syncRegistry.getProvider("freshrss");
    expect(freshrss).toBeDefined();
    expect(freshrss?.name).toBe("FreshRSS");
  });

  it("should validate provider configuration rules", async () => {
    const movieTracker = new MovieTrackerSyncProvider();
    const lastfm = new LastfmSyncProvider();
    const bluesky = new BlueskySyncProvider();
    const mastodon = new MastodonSyncProvider();
    const freshrss = new FreshRSSSyncProvider();

    // Invalid config
    const invalidTracker = await movieTracker.validateConfiguration({});
    expect(invalidTracker.valid).toBe(false);
    expect(invalidTracker.error).toContain("Movie Tracker App URL is required");

    const invalidTrackerKey = await movieTracker.validateConfiguration({ apiUrl: "https://movie-trackerh.vercel.app" });
    expect(invalidTrackerKey.valid).toBe(false);
    expect(invalidTrackerKey.error).toContain("API Key is required");

    const validTracker = await movieTracker.validateConfiguration({
      apiUrl: "https://movie-trackerh.vercel.app",
      apiKey: "cin_live_test_key_123",
    });
    expect(validTracker.valid).toBe(true);

    const invalidFreshRSS = await freshrss.validateConfiguration({ instanceUrl: "https://rss.example.com" });
    expect(invalidFreshRSS.valid).toBe(false);
    expect(invalidFreshRSS.error).toContain("Username");

    const validFreshRSS = await freshrss.validateConfiguration({
      instanceUrl: "https://rss.example.com",
      username: "user",
      apiPassword: "password123",
    });
    expect(validFreshRSS.valid).toBe(true);
  });

  it("should fetch statistics structure for providers", async () => {
    const movieTracker = new MovieTrackerSyncProvider();
    const trackerStats = await movieTracker.getStatistics();
    expect(trackerStats).toHaveProperty("Movies Watched");
    expect(trackerStats).toHaveProperty("TV Shows");
    expect(trackerStats).toHaveProperty("Episodes");

    const freshrss = new FreshRSSSyncProvider();
    const freshrssStats = await freshrss.getStatistics();
    expect(freshrssStats).toHaveProperty("Read Articles");
    expect(freshrssStats).toHaveProperty("Starred Articles");
    expect(freshrssStats).toHaveProperty("Subscribed Feeds");
  });

  it("should support connecting and status updating", async () => {
    const movieTracker = new MovieTrackerSyncProvider();
    await movieTracker.updateStatus("connected");

    const status = await movieTracker.getStatus();
    expect(status).toBe("connected");

    const record = await db.select().from(providers).where(eq(providers.slug, "movie_tracker")).limit(1);
    expect(record[0]).toBeDefined();
    expect(record[0].status).toBe("connected");
  });

  it("should support cancelling active sync", async () => {
    const movieTracker = new MovieTrackerSyncProvider();
    await movieTracker.updateStatus("syncing");

    const cancelled = await movieTracker.cancelSync();
    expect(cancelled).toBe(true);

    const status = await movieTracker.getStatus();
    expect(status).toBe("connected");
  });
});
