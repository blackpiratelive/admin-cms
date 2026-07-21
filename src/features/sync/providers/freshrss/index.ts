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

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
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
    if (base.endsWith("/api/greader.php") || base.endsWith("/p/api/greader.php") || base.endsWith("/i/api/greader.php")) {
      return [base];
    }
    return [
      `${base}/api/greader.php`,
      `${base}/p/api/greader.php`,
      `${base}/i/api/greader.php`,
      base,
    ];
  }

  private async getAuthHeaders(config: FreshRSSConfig): Promise<{ authHeader: string; baseUrl: string }> {
    const baseUrls = this.getGReaderBaseUrls(config.instanceUrl);
    const username = config.username.trim();
    const password = config.apiPassword.trim();

    let authError: string | null = null;
    let notFoundError: string | null = null;
    let otherError: string | null = null;

    const commonHeaders = {
      "User-Agent": "AdminCMS-FreshRSSSync/1.0 (Google Reader API Client)",
    };

    for (const baseUrl of baseUrls) {
      try {
        // 1. Try ClientLogin endpoint with official Google Reader API parameter Passwd
        const loginRes = await fetch(`${baseUrl}/accounts/ClientLogin`, {
          method: "POST",
          headers: {
            ...commonHeaders,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `Email=${encodeURIComponent(username)}&Passwd=${encodeURIComponent(password)}&Pass=${encodeURIComponent(password)}&password=${encodeURIComponent(password)}&account=${encodeURIComponent(username)}&user=${encodeURIComponent(username)}`,
        });

        if (loginRes.ok) {
          const bodyText = await loginRes.text();
          const authLine = bodyText.split("\n").find((line) => line.trim().startsWith("Auth="));
          if (authLine) {
            const rawToken = authLine.trim().substring(5).trim();
            if (rawToken) {
              const authHeader = rawToken.startsWith("GoogleLogin auth=")
                ? rawToken
                : `GoogleLogin auth=${rawToken}`;

              // Verify token on user-info endpoint
              const verifyRes = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
                headers: { ...commonHeaders, Authorization: authHeader },
              });
              if (verifyRes.ok) {
                return { authHeader, baseUrl };
              }
            }
          }
        }

        if (loginRes.status === 401 || loginRes.status === 403) {
          authError = `FreshRSS API endpoint found at ${baseUrl}, but authentication was rejected (HTTP ${loginRes.status}). Please verify: 1) API access is enabled under FreshRSS Profile -> Settings -> API. 2) You are using your API password (set in API settings), not your web login password.`;
        }

        // 2. Direct token format: GoogleLogin auth=username/apiPassword
        const directToken1 = `GoogleLogin auth=${username}/${password}`;
        const directRes1 = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
          headers: { ...commonHeaders, Authorization: directToken1 },
        });
        if (directRes1.ok) {
          return { authHeader: directToken1, baseUrl };
        }

        // 3. Direct token format: GoogleLogin auth=apiPassword
        const directToken2 = `GoogleLogin auth=${password}`;
        const directRes2 = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
          headers: { ...commonHeaders, Authorization: directToken2 },
        });
        if (directRes2.ok) {
          return { authHeader: directToken2, baseUrl };
        }

        if (directRes1.status === 401 || directRes1.status === 403) {
          authError = `FreshRSS API endpoint found at ${baseUrl}, but authentication was rejected (HTTP ${directRes1.status}). Please verify: 1) API access is enabled under FreshRSS Profile -> Settings -> API. 2) You are using your API password (set in API settings), not your web login password.`;
        }

        // 4. Fallback: HTTP Basic Auth header
        const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
        const basicRes = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
          headers: { ...commonHeaders, Authorization: basicAuth },
        });
        if (basicRes.ok) {
          return { authHeader: basicAuth, baseUrl };
        }

        if (basicRes.status === 401 || basicRes.status === 403) {
          authError = `FreshRSS API endpoint found at ${baseUrl}, but authentication was rejected (HTTP ${basicRes.status}). Please verify: 1) API access is enabled under FreshRSS Profile -> Settings -> API. 2) You are using your API password (set in API settings), not your web login password.`;
        } else if (loginRes.status === 404 && basicRes.status === 404) {
          notFoundError = `FreshRSS API endpoint not found at ${baseUrl}.`;
        } else {
          otherError = `FreshRSS returned HTTP ${loginRes.status || basicRes.status} at ${baseUrl}.`;
        }
      } catch (err: any) {
        otherError = err.message || String(err);
      }
    }

    throw new Error(
      authError ||
        notFoundError ||
        otherError ||
        `Could not authenticate with FreshRSS at ${config.instanceUrl}. Ensure API access is enabled in FreshRSS -> Profile -> Settings -> API and your API password is set.`
    );
  }

  async testConnection(config: Record<string, any>): Promise<boolean> {
    const validation = await this.validateConfiguration(config);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid configuration");
    }

    const { authHeader, baseUrl } = await this.getAuthHeaders(config as FreshRSSConfig);
    const res = await fetch(`${baseUrl}/reader/api/0/user-info?output=json`, {
      headers: {
        "User-Agent": "AdminCMS-FreshRSSSync/1.0 (Google Reader API Client)",
        Authorization: authHeader,
      },
    });
    if (!res.ok) {
      throw new Error(`FreshRSS check returned HTTP ${res.status} (${res.statusText}).`);
    }
    const data = await res.json();
    if (!data.userId && !data.userName) {
      throw new Error("FreshRSS user-info endpoint did not return valid user data.");
    }
    return true;
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

  private async fetchStreamPages(
    baseUrl: string,
    authHeader: string,
    streamPath: string,
    maxPages = 5,
    onProgress?: (msg: string) => void
  ): Promise<any[]> {
    const allItems: any[] = [];
    let continuationToken: string | null = null;
    const seenTokens = new Set<string>();

    const commonHeaders = {
      "User-Agent": "AdminCMS-FreshRSSSync/1.0 (Google Reader API Client)",
      Authorization: authHeader,
    };

    for (let p = 0; p < maxPages; p++) {
      this.checkCancelled();
      let url = `${baseUrl}/reader/api/0/stream/contents/${streamPath}?output=json&n=1000`;
      if (continuationToken) {
        if (seenTokens.has(continuationToken)) {
          break;
        }
        seenTokens.add(continuationToken);
        url += `&c=${encodeURIComponent(continuationToken)}`;
      }

      onProgress?.(`Fetching ${streamPath} (page ${p + 1}/${maxPages})...`);
      try {
        const res = await fetch(url, {
          headers: commonHeaders,
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) break;

        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          allItems.push(...data.items);
          onProgress?.(`Retrieved ${data.items.length} items from ${streamPath} (total: ${allItems.length}).`);
        } else {
          break;
        }

        if (data.continuation && typeof data.continuation === "string" && data.continuation.trim()) {
          continuationToken = data.continuation.trim();
        } else {
          break;
        }
      } catch (err: any) {
        console.warn(`Error fetching ${streamPath} page ${p + 1}:`, err);
        onProgress?.(`Warning: page ${p + 1} fetch timed out or failed: ${err.message || String(err)}`);
        break;
      }
    }

    return allItems;
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
        headers: {
          "User-Agent": "AdminCMS-FreshRSSSync/1.0 (Google Reader API Client)",
          Authorization: authHeader,
        },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        const subscriptions = subData.subscriptions || [];

        const existingCats = await db.select().from(rssCategories);
        const existingCatIds = new Set(existingCats.map((c) => c.categoryId));

        const existingFeedsList = await db.select().from(rssFeeds);
        const existingFeedIds = new Set(existingFeedsList.map((f) => f.feedId));

        const newCatsToInsert: any[] = [];
        const newFeedsToInsert: any[] = [];

        for (const sub of subscriptions) {
          const feedId = String(sub.id || sub.url || "");
          if (!feedId) continue;

          const categoryName = sub.categories && sub.categories[0] ? sub.categories[0].label : "General";
          const categoryId = sub.categories && sub.categories[0] ? String(sub.categories[0].id) : "cat_general";

          if (!existingCatIds.has(categoryId)) {
            existingCatIds.add(categoryId);
            newCatsToInsert.push({
              id: `rss_cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              categoryId,
              name: categoryName,
              createdAt: now,
              updatedAt: now,
            });
          }

          if (!existingFeedIds.has(feedId)) {
            existingFeedIds.add(feedId);
            newFeedsToInsert.push({
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

        if (newCatsToInsert.length > 0) {
          for (const batch of chunkArray(newCatsToInsert, 100)) {
            await db.insert(rssCategories).values(batch).onConflictDoNothing();
          }
        }
        if (newFeedsToInsert.length > 0) {
          for (const batch of chunkArray(newFeedsToInsert, 100)) {
            await db.insert(rssFeeds).values(batch).onConflictDoNothing();
          }
        }
      }
    } catch (catErr) {
      console.warn("FreshRSS feed sync warning:", catErr);
    }

    // 2. Fetch Read & Starred Stream Pages
    const maxPages = options?.mode === "batch" ? (options?.batchSize || 20) : 5;

    options?.onProgress?.(`Fetching read articles stream (up to ${maxPages} pages)...`);
    const readItems = await this.fetchStreamPages(
      baseUrl,
      authHeader,
      "user/-/state/com.google/read",
      maxPages,
      options?.onProgress
    );

    options?.onProgress?.(`Fetching starred articles stream (up to ${maxPages} pages)...`);
    const starredItems = await this.fetchStreamPages(
      baseUrl,
      authHeader,
      "user/-/state/com.google/starred",
      maxPages,
      options?.onProgress
    );

    // Combine items into unified map
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

    options?.onProgress?.(`Processing ${allItemsMap.size} articles in high-performance batch mode...`);

    // Fetch existing articles into memory for fast O(1) bulk processing
    const existingArticlesList = await db
      .select({
        id: rssArticles.id,
        freshrssId: rssArticles.freshrssId,
        isRead: rssArticles.isRead,
        isStarred: rssArticles.isStarred,
        readDate: rssArticles.readDate,
        starredAt: rssArticles.starredAt,
      })
      .from(rssArticles);

    const existingMap = new Map(existingArticlesList.map((a) => [a.freshrssId, a]));

    const newArticlesToInsert: any[] = [];
    const newReadEventsToInsert: any[] = [];
    const newStarredEventsToInsert: any[] = [];
    const newSearchEntriesToUpsert: any[] = [];
    const articlesToUpdate: Array<{ id: string; data: Record<string, any> }> = [];

    for (const [freshrssId, record] of allItemsMap.entries()) {
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

      const existing = existingMap.get(freshrssId);

      if (existing) {
        const needsUpdate =
          (record.isRead && !existing.isRead) ||
          (record.isStarred && !existing.isStarred);

        if (needsUpdate) {
          articlesToUpdate.push({
            id: freshrssId,
            data: {
              isRead: record.isRead ? 1 : existing.isRead,
              isStarred: record.isStarred ? 1 : existing.isStarred,
              readDate: readDate || existing.readDate,
              starredAt: starredAt || existing.starredAt,
              updatedAt: now,
            },
          });
        }
      } else {
        const articleId = `rss_art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        newArticlesToInsert.push({
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

        if (record.isRead) {
          newReadEventsToInsert.push({
            id: `rss_re_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            articleId,
            readAt: readDate || pubDate,
            createdAt: now,
          });
        }

        if (record.isStarred) {
          newStarredEventsToInsert.push({
            id: `rss_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            articleId,
            starredAt: starredAt || pubDate,
            createdAt: now,
          });
        }

        newSearchEntriesToUpsert.push({
          entityType: "rss_article",
          entityId: articleId,
          title,
          subtitle: `${feedName}${category ? ` • ${category}` : ""}`,
          keywords: `${title} ${feedName} ${category} ${author || ""}`.toLowerCase(),
          url: originalUrl,
        });
      }
    }

    // High-performance bulk database insertions
    if (newArticlesToInsert.length > 0) {
      options?.onProgress?.(`Inserting ${newArticlesToInsert.length} new articles into database...`);
      for (const batch of chunkArray(newArticlesToInsert, 100)) {
        await db.insert(rssArticles).values(batch).onConflictDoNothing();
      }
      itemsCreated = newArticlesToInsert.length;
    }

    if (newReadEventsToInsert.length > 0) {
      for (const batch of chunkArray(newReadEventsToInsert, 100)) {
        await db.insert(rssReadEvents).values(batch).onConflictDoNothing();
      }
    }

    if (newStarredEventsToInsert.length > 0) {
      for (const batch of chunkArray(newStarredEventsToInsert, 100)) {
        await db.insert(rssStarredArticles).values(batch).onConflictDoNothing();
      }
    }

    if (articlesToUpdate.length > 0) {
      options?.onProgress?.(`Updating ${articlesToUpdate.length} modified articles...`);
      for (const item of articlesToUpdate) {
        await db
          .update(rssArticles)
          .set(item.data)
          .where(eq(rssArticles.freshrssId, item.id));
      }
      itemsUpdated = articlesToUpdate.length;
    }

    // Bulk Search Indexing
    if (newSearchEntriesToUpsert.length > 0) {
      options?.onProgress?.(`Indexing ${newSearchEntriesToUpsert.length} articles for universal search...`);
      for (const entry of newSearchEntriesToUpsert) {
        await upsertSearchEntry(entry);
      }
    }

    // Save sync checkpoint
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
    options?.onProgress?.("Rebuilding reading analytics cache...");
    try {
      await rebuildAllAnalyticsCache();
    } catch (aErr) {
      console.warn("Analytics update after FreshRSS sync warning:", aErr);
    }

    options?.onProgress?.(`FreshRSS sync completed. ${itemsCreated} articles created, ${itemsUpdated} updated.`);

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
