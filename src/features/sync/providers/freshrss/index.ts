import { BaseSyncProvider } from "../../base-provider";
import { ConfigField, ConfigValidationResult, SyncOptions, SyncResult } from "../../types";
import { db, ensureDbInitialized } from "@/db";
import { rssArticles, rssFeeds, rssCategories, rssReadEvents, rssStarredArticles, rssSyncState } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { upsertSearchEntry } from "@/features/search/search-index";
import { rebuildAllAnalyticsCache } from "@/features/analytics/core";

export interface FreshRSSConfig {
  instanceUrl: string;
  username: string;
  apiPassword: string;
}

export class FreshRSSSyncProvider extends BaseSyncProvider {
  id = "freshrss";
  name = "FreshRSS";
  slug = "freshrss";
  icon = "📰";
  description = "Sync reading history, starred articles, feeds, and categories from self-hosted FreshRSS";

  getConfigFields(): ConfigField[] {
    return [
      {
        name: "instanceUrl",
        label: "FreshRSS URL",
        type: "text",
        placeholder: "https://rss.example.com",
        required: true,
        description: "The full base URL of your self-hosted FreshRSS instance (e.g. https://rss.example.com).",
      },
      {
        name: "username",
        label: "Username",
        type: "text",
        placeholder: "freshrss_username",
        required: true,
        description: "Your FreshRSS account username.",
      },
      {
        name: "apiPassword",
        label: "API Password / Token",
        type: "password",
        placeholder: "API Password (set in FreshRSS Profile -> Settings -> API)",
        required: true,
        description: "API password configured in FreshRSS account settings (not your web UI password).",
      },
    ];
  }

  async validateConfiguration(config: Record<string, any>): Promise<ConfigValidationResult> {
    if (!config.instanceUrl || typeof config.instanceUrl !== "string" || !config.instanceUrl.trim()) {
      return { valid: false, error: "FreshRSS URL is required." };
    }
    if (!config.username || typeof config.username !== "string" || !config.username.trim()) {
      return { valid: false, error: "FreshRSS Username is required." };
    }
    if (!config.apiPassword || typeof config.apiPassword !== "string" || !config.apiPassword.trim()) {
      return { valid: false, error: "FreshRSS API Password is required." };
    }
    return { valid: true };
  }

  private normalizeUrl(urlStr: string): string {
    let url = urlStr.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    return url.replace(/\/+$/, "");
  }

  private getGReaderBaseUrls(instanceUrl: string): string[] {
    const base = this.normalizeUrl(instanceUrl);
    if (base.endsWith("/api/greader.php") || base.endsWith("/p/api/greader.php")) {
      return [base];
    }
    return [
      `${base}/api/greader.php`,
      `${base}/p/api/greader.php`,
      base,
    ];
  }

  private async getAuthHeaders(config: FreshRSSConfig): Promise<{ authHeader: string; baseUrl: string }> {
    const baseUrls = this.getGReaderBaseUrls(config.instanceUrl);
    const username = config.username.trim();
    const password = config.apiPassword.trim();

    let lastError: any = null;

    for (const baseUrl of baseUrls) {
      try {
        // Try ClientLogin first
        const loginRes = await fetch(`${baseUrl}/accounts/ClientLogin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `Email=${encodeURIComponent(username)}&Pass=${encodeURIComponent(password)}`,
        });

        if (loginRes.ok) {
          const bodyText = await loginRes.text();
          const match = bodyText.match(/Auth=([^\s]+)/);
          if (match && match[1]) {
            return {
              authHeader: `GoogleLogin auth=${match[1]}`,
              baseUrl,
            };
          }
        }

        // Fallback: Check user-info using HTTP Basic Auth
        const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
        const userInfoRes = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
          headers: { Authorization: basicAuth },
        });

        if (userInfoRes.ok) {
          return {
            authHeader: basicAuth,
            baseUrl,
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      `Could not authenticate with FreshRSS at ${config.instanceUrl}. Please check your URL, username, and API Password. ${
        lastError ? `(${lastError.message})` : ""
      }`
    );
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) return false;

    try {
      const { authHeader, baseUrl } = await this.getAuthHeaders(config as FreshRSSConfig);
      const res = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.userId || !!data.userName;
    } catch {
      return false;
    }
  }

  async getStatistics(): Promise<Record<string, number | string>> {
    await ensureDbInitialized();
    try {
      const [readRes, starredRes, feedRes] = await Promise.all([
        db.select({ value: count() }).from(rssArticles).where(eq(rssArticles.isRead, 1)),
        db.select({ value: count() }).from(rssArticles).where(eq(rssArticles.isStarred, 1)),
        db.select({ value: count() }).from(rssFeeds),
      ]);

      const totalRead = readRes[0]?.value || 0;
      const totalStarred = starredRes[0]?.value || 0;
      const totalFeeds = feedRes[0]?.value || 0;

      return {
        "Read Articles": totalRead,
        "Starred Articles": totalStarred,
        "Subscribed Feeds": totalFeeds,
      };
    } catch {
      return { Status: "Not Initialized" };
    }
  }

  protected async executeSync(config: Record<string, any>, options?: SyncOptions): Promise<SyncResult> {
    this.checkCancelled();
    await ensureDbInitialized();

    const now = new Date().toISOString();
    options?.onProgress?.("Authenticating with FreshRSS...");

    const { authHeader, baseUrl } = await this.getAuthHeaders(config as FreshRSSConfig);

    let itemsCreated = 0;
    let itemsUpdated = 0;

    // 1. Sync Subscriptions & Categories
    options?.onProgress?.("Fetching feeds and categories...");
    try {
      const subRes = await fetch(`${baseUrl}/reader/api/0/subscription/list?output=json`, {
        headers: { Authorization: authHeader },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        const subscriptions = subData.subscriptions || [];

        for (const sub of subscriptions) {
          const feedId = String(sub.id || sub.url || "");
          if (!feedId) continue;

          const categoryName = sub.categories && sub.categories[0] ? sub.categories[0].label : "General";
          const categoryId = sub.categories && sub.categories[0] ? String(sub.categories[0].id) : "cat_general";

          // Upsert category
          const existingCat = await db.select().from(rssCategories).where(eq(rssCategories.categoryId, categoryId)).limit(1);
          if (existingCat.length === 0) {
            await db.insert(rssCategories).values({
              id: `rss_cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              categoryId,
              name: categoryName,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Upsert feed
          const existingFeed = await db.select().from(rssFeeds).where(eq(rssFeeds.feedId, feedId)).limit(1);
          if (existingFeed.length > 0) {
            await db
              .update(rssFeeds)
              .set({
                name: sub.title || feedId,
                category: categoryName,
                website: sub.htmlUrl || null,
                iconUrl: sub.iconUrl || null,
                updatedAt: now,
              })
              .where(eq(rssFeeds.feedId, feedId));
          } else {
            await db.insert(rssFeeds).values({
              id: `rss_feed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              feedId,
              name: sub.title || feedId,
              category: categoryName,
              website: sub.htmlUrl || null,
              iconUrl: sub.iconUrl || null,
              unreadCount: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    } catch (catErr) {
      console.warn("FreshRSS feed sync warning:", catErr);
    }

    // 2. Fetch Read Articles
    this.checkCancelled();
    options?.onProgress?.("Fetching read articles activity...");
    const readItems: any[] = [];
    try {
      const readRes = await fetch(`${baseUrl}/reader/api/0/stream/contents/user/-/state/com.google/read?output=json&n=1000`, {
        headers: { Authorization: authHeader },
      });
      if (readRes.ok) {
        const readData = await readRes.json();
        if (Array.isArray(readData.items)) {
          readItems.push(...readData.items);
        }
      }
    } catch (readErr) {
      console.warn("FreshRSS read stream warning:", readErr);
    }

    // 3. Fetch Starred Articles
    this.checkCancelled();
    options?.onProgress?.("Fetching starred articles...");
    const starredItems: any[] = [];
    try {
      const starredRes = await fetch(`${baseUrl}/reader/api/0/stream/contents/user/-/state/com.google/starred?output=json&n=1000`, {
        headers: { Authorization: authHeader },
      });
      if (starredRes.ok) {
        const starredData = await starredRes.json();
        if (Array.isArray(starredData.items)) {
          starredItems.push(...starredData.items);
        }
      }
    } catch (starredErr) {
      console.warn("FreshRSS starred stream warning:", starredErr);
    }

    // Process all items
    const allItemsMap = new Map<string, { item: any; isRead: boolean; isStarred: boolean }>();

    for (const item of readItems) {
      if (!item.id) continue;
      allItemsMap.set(item.id, { item, isRead: true, isStarred: false });
    }

    for (const item of starredItems) {
      if (!item.id) continue;
      const existing = allItemsMap.get(item.id);
      if (existing) {
        existing.isStarred = true;
      } else {
        allItemsMap.set(item.id, { item, isRead: false, isStarred: true });
      }
    }

    options?.onProgress?.(`Processing ${allItemsMap.size} reading events...`);

    for (const [freshrssId, record] of allItemsMap.entries()) {
      this.checkCancelled();
      const item = record.item;
      const title = item.title || "Untitled Article";
      const originalUrl =
        (item.alternate && item.alternate[0] && item.alternate[0].href) ||
        (item.canonical && item.canonical[0] && item.canonical[0].href) ||
        baseUrl;

      const pubTs = item.published || item.updated || Math.floor(Date.now() / 1000);
      const pubDate = new Date(pubTs * 1000).toISOString();
      const readDate = record.isRead ? pubDate : null;
      const starredAt = record.isStarred ? pubDate : null;

      // Calculate approximate word count and reading time without storing full content body
      let wordCount = 0;
      let readingTimeSec = 0;
      if (item.summary && item.summary.content) {
        const plainText = item.summary.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        wordCount = plainText.split(" ").filter(Boolean).length;
        readingTimeSec = Math.max(30, Math.ceil((wordCount / 200) * 60));
      }

      const feedName = item.origin ? item.origin.title || item.origin.streamId : "RSS Feed";
      const feedId = item.origin ? item.origin.streamId : null;
      const author = item.author || null;
      const category = (item.categories && item.categories[0]) || "General";
      const tagsJson = JSON.stringify(item.categories || []);

      const existingArt = await db.select().from(rssArticles).where(eq(rssArticles.freshrssId, freshrssId)).limit(1);

      if (existingArt.length > 0) {
        await db
          .update(rssArticles)
          .set({
            title,
            originalUrl,
            feedId,
            feedName,
            category,
            author,
            wordCount,
            readingTime: readingTimeSec,
            isRead: record.isRead ? 1 : existingArt[0].isRead,
            isStarred: record.isStarred ? 1 : existingArt[0].isStarred,
            readDate: readDate || existingArt[0].readDate,
            starredAt: starredAt || existingArt[0].starredAt,
            updatedAt: now,
          })
          .where(eq(rssArticles.freshrssId, freshrssId));

        itemsUpdated++;
      } else {
        const articleId = `rss_art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(rssArticles).values({
          id: articleId,
          freshrssId,
          feedId,
          feedName,
          category,
          title,
          originalUrl,
          publicationDate: pubDate,
          readDate,
          author,
          readingTime: readingTimeSec,
          tags: tagsJson,
          wordCount,
          isRead: record.isRead ? 1 : 0,
          isStarred: record.isStarred ? 1 : 0,
          starredAt,
          createdAt: now,
          updatedAt: now,
        });

        // Insert read event log
        if (record.isRead) {
          await db.insert(rssReadEvents).values({
            id: `rss_re_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            articleId,
            readAt: readDate || pubDate,
            createdAt: now,
          });
        }

        // Insert starred event log
        if (record.isStarred) {
          await db.insert(rssStarredArticles).values({
            id: `rss_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            articleId,
            starredAt: starredAt || pubDate,
            createdAt: now,
          });
        }

        // Upsert Search Entry for multi-table universal search
        await upsertSearchEntry({
          entityType: "rss_article",
          entityId: articleId,
          title,
          subtitle: `${feedName}${category ? ` • ${category}` : ""}`,
          keywords: `${title} ${feedName} ${category} ${author || ""}`.toLowerCase(),
          url: originalUrl,
        });

        itemsCreated++;
      }
    }

    // Save sync state
    const existingSyncState = await db.select().from(rssSyncState).limit(1);
    if (existingSyncState.length > 0) {
      await db.update(rssSyncState).set({ lastSync: now, updatedAt: now }).where(eq(rssSyncState.id, existingSyncState[0].id));
    } else {
      await db.insert(rssSyncState).values({
        id: "freshrss_checkpoint",
        lastSync: now,
        updatedAt: now,
      });
    }

    // Asynchronously rebuild analytics cache to incorporate reading activity
    options?.onProgress?.("Updating reading analytics and discovery graph...");
    try {
      await rebuildAllAnalyticsCache();
    } catch (aErr) {
      console.warn("Analytics update after FreshRSS sync warning:", aErr);
    }

    return {
      success: true,
      itemsCreated,
      itemsUpdated,
      itemsDeleted: 0,
      metadata: {
        totalImported: allItemsMap.size,
        readCount: readItems.length,
        starredCount: starredItems.length,
      },
    };
  }
}
