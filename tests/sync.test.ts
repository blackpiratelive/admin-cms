import { describe, it, expect, beforeEach } from "vitest";
import { syncRegistry } from "../src/features/sync/registry";
import { TraktSyncProvider } from "../src/features/sync/providers/trakt";
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

    const trakt = syncRegistry.getProvider("trakt");
    expect(trakt).toBeDefined();

    const freshrss = syncRegistry.getProvider("freshrss");
    expect(freshrss).toBeDefined();
    expect(freshrss?.name).toBe("FreshRSS");
  });

  it("should validate provider configuration rules", async () => {
    const trakt = new TraktSyncProvider();
    const lastfm = new LastfmSyncProvider();
    const bluesky = new BlueskySyncProvider();
    const mastodon = new MastodonSyncProvider();
    const freshrss = new FreshRSSSyncProvider();

    // Invalid config
    const invalidTrakt = await trakt.validateConfiguration({});
    expect(invalidTrakt.valid).toBe(false);

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
    const trakt = new TraktSyncProvider();
    const traktStats = await trakt.getStatistics();
    expect(traktStats).toHaveProperty("Movies");

    const freshrss = new FreshRSSSyncProvider();
    const freshrssStats = await freshrss.getStatistics();
    expect(freshrssStats).toHaveProperty("Read Articles");
    expect(freshrssStats).toHaveProperty("Starred Articles");
    expect(freshrssStats).toHaveProperty("Subscribed Feeds");
  });

  it("should support connecting and status updating", async () => {
    const trakt = new TraktSyncProvider();
    await trakt.updateStatus("connected");

    const status = await trakt.getStatus();
    expect(status).toBe("connected");

    const record = await db.select().from(providers).where(eq(providers.slug, "trakt")).limit(1);
    expect(record[0]).toBeDefined();
    expect(record[0].status).toBe("connected");
  });

  it("should support cancelling active sync", async () => {
    const trakt = new TraktSyncProvider();
    await trakt.updateStatus("syncing");

    const cancelled = await trakt.cancelSync();
    expect(cancelled).toBe(true);

    const status = await trakt.getStatus();
    expect(status).toBe("connected");
  });
});
