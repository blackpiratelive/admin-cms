import { describe, it, expect, beforeEach } from "vitest";
import { ensureDbInitialized, db } from "../src/db";
import { rssArticles, rssFeeds } from "../src/db/schema";
import { readingAnalyticsProvider } from "../src/features/analytics/providers/reading";
import { getReadingAroundTimeAction, getReadingArticlesAction } from "../src/features/reading/actions";
import { FreshRSSSyncProvider } from "../src/features/sync/providers/freshrss";

describe("FreshRSS Sync Provider & Reading Analytics Subsystem", () => {
  beforeEach(async () => {
    await ensureDbInitialized();
    await db.delete(rssArticles);
    await db.delete(rssFeeds);
  });

  it("should validate FreshRSS configuration fields", async () => {
    const provider = new FreshRSSSyncProvider();
    const fields = provider.getConfigFields();
    expect(fields.map((f) => f.name)).toEqual(["instanceUrl", "username", "apiPassword"]);

    const invalid = await provider.validateConfiguration({});
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toBeDefined();

    const valid = await provider.validateConfiguration({
      instanceUrl: "https://rss.example.com",
      username: "alex",
      apiPassword: "secret_token",
    });
    expect(valid.valid).toBe(true);
  });

  it("should insert reading articles and compute analytics metrics", async () => {
    const now = new Date().toISOString();
    const todayStr = now.slice(0, 10);

    await db.insert(rssArticles).values([
      {
        id: "art_1",
        freshrssId: "tag:google.com,2005:reader/item/0000000000000001",
        feedId: "feed_1",
        feedName: "TechCrunch",
        category: "Technology",
        title: "SQLite 3.50 Released",
        originalUrl: "https://example.com/sqlite-350",
        publicationDate: now,
        readDate: now,
        author: "John Doe",
        readingTime: 120,
        wordCount: 400,
        isRead: 1,
        isStarred: 1,
        starredAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "art_2",
        freshrssId: "tag:google.com,2005:reader/item/0000000000000002",
        feedId: "feed_2",
        feedName: "Drizzle ORM Blog",
        category: "Development",
        title: "Drizzle v1.0 Launch",
        originalUrl: "https://example.com/drizzle-launch",
        publicationDate: now,
        readDate: now,
        author: "Jane Smith",
        readingTime: 180,
        wordCount: 600,
        isRead: 1,
        isStarred: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const stats = await readingAnalyticsProvider.computeAnalytics();

    expect(stats.totalRead).toBe(2);
    expect(stats.readToday).toBe(2);
    expect(stats.totalStarred).toBe(1);
    expect(stats.favoriteSources.length).toBeGreaterThan(0);
    expect(stats.mostReadCategory?.category).toBeDefined();
  });

  it("should query reading influence around a target date", async () => {
    const now = new Date();
    const targetDateIso = now.toISOString();

    await db.insert(rssArticles).values({
      id: "art_influence_1",
      freshrssId: "tag:google.com,2005:reader/item/0000000000000099",
      feedId: "feed_tech",
      feedName: "Ars Technica",
      category: "Tech",
      title: "AI & Neural Networks Architecture",
      originalUrl: "https://arstechnica.com/ai-arch",
      publicationDate: targetDateIso,
      readDate: targetDateIso,
      readingTime: 200,
      wordCount: 750,
      isRead: 1,
      isStarred: 1,
      starredAt: targetDateIso,
      createdAt: targetDateIso,
      updatedAt: targetDateIso,
    });

    const influenceArticles = await getReadingAroundTimeAction(targetDateIso);
    expect(influenceArticles.length).toBeGreaterThan(0);
    expect(influenceArticles[0].title).toBe("AI & Neural Networks Architecture");
  });

  it("should filter articles in getReadingArticlesAction", async () => {
    const now = new Date().toISOString();
    await db.insert(rssArticles).values([
      {
        id: "art_starred_only",
        freshrssId: "freshrss_starred_item",
        title: "Important Research Paper",
        originalUrl: "https://arxiv.org/abs/12345",
        feedId: "arxiv",
        feedName: "arXiv",
        category: "Science",
        isRead: 1,
        isStarred: 1,
        readDate: now,
        starredAt: now,
        wordCount: 1200,
        readingTime: 360,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const starredRes = await getReadingArticlesAction({ filter: "starred" });
    expect(starredRes.items.length).toBe(1);
    expect(starredRes.items[0].title).toBe("Important Research Paper");
  });
});
