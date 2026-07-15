import { describe, it, expect, beforeEach } from "vitest";
import { syncRegistry } from "../src/features/sync/registry";
import { TraktSyncProvider } from "../src/features/sync/providers/trakt";
import { LastfmSyncProvider } from "../src/features/sync/providers/lastfm";
import { BlueskySyncProvider } from "../src/features/sync/providers/bluesky";
import { MastodonSyncProvider } from "../src/features/sync/providers/mastodon";
import { ensureDbInitialized, db } from "../src/db";
import { providers, syncLogs } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("Sync Center Provider Registry & Architecture", () => {
  beforeEach(async () => {
    await ensureDbInitialized();
  });

  it("should discover registered providers", () => {
    const allProviders = syncRegistry.getAllProviders();
    expect(allProviders.length).toBeGreaterThanOrEqual(4);

    const trakt = syncRegistry.getProvider("trakt");
    expect(trakt).toBeDefined();
    expect(trakt?.name).toBe("Trakt");

    const lastfm = syncRegistry.getProvider("lastfm");
    expect(lastfm).toBeDefined();
    expect(lastfm?.name).toBe("Last.fm");

    const bluesky = syncRegistry.getProvider("bluesky");
    expect(bluesky).toBeDefined();
    expect(bluesky?.name).toBe("Bluesky");

    const mastodon = syncRegistry.getProvider("mastodon");
    expect(mastodon).toBeDefined();
    expect(mastodon?.name).toBe("Mastodon");
  });

  it("should validate provider configuration rules", async () => {
    const trakt = new TraktSyncProvider();
    const lastfm = new LastfmSyncProvider();
    const bluesky = new BlueskySyncProvider();
    const mastodon = new MastodonSyncProvider();

    // Invalid config
    const invalidTrakt = await trakt.validateConfiguration({});
    expect(invalidTrakt.valid).toBe(false);
    expect(invalidTrakt.error).toContain("username");

    const invalidLastfm = await lastfm.validateConfiguration({ username: "user" });
    expect(invalidLastfm.valid).toBe(false);
    expect(invalidLastfm.error).toContain("API Key");

    const invalidBluesky = await bluesky.validateConfiguration({ identifier: "user.bsky.social" });
    expect(invalidBluesky.valid).toBe(false);
    expect(invalidBluesky.error).toContain("App Password");

    const invalidMastodon = await mastodon.validateConfiguration({ instanceUrl: "https://mastodon.social" });
    expect(invalidMastodon.valid).toBe(false);
    expect(invalidMastodon.error).toContain("Access Token");

    // Valid config structure
    const validTrakt = await trakt.validateConfiguration({ username: "user", clientId: "client123", clientSecret: "secret123" });
    expect(validTrakt.valid).toBe(true);

    const validLastfm = await lastfm.validateConfiguration({ username: "user", apiKey: "api123" });
    expect(validLastfm.valid).toBe(true);

    const validBluesky = await bluesky.validateConfiguration({ identifier: "user.bsky.social", appPassword: "password123" });
    expect(validBluesky.valid).toBe(true);

    const validMastodon = await mastodon.validateConfiguration({ instanceUrl: "https://mastodon.social", accessToken: "token123" });
    expect(validMastodon.valid).toBe(true);
  });

  it("should fetch statistics structure for providers", async () => {
    const trakt = new TraktSyncProvider();
    const traktStats = await trakt.getStatistics();
    expect(traktStats).toHaveProperty("Movies");
    expect(traktStats).toHaveProperty("Shows");
    expect(traktStats).toHaveProperty("Episodes");

    const lastfm = new LastfmSyncProvider();
    const lastfmStats = await lastfm.getStatistics();
    expect(lastfmStats).toHaveProperty("Scrobbles");
    expect(lastfmStats).toHaveProperty("Artists");
    expect(lastfmStats).toHaveProperty("Albums");
    expect(lastfmStats).toHaveProperty("Tracks");
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
