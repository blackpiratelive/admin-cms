"use server";

import { db, ensureDbInitialized } from "@/db";
import { microblogs, relatedMicroblogs } from "@/db/schema";
import { count, eq, like, and, desc, or } from "drizzle-orm";
import { generateSlug, microblogInputSchema, type MicroblogFormInput } from "./schema";
import { triggerVercelDeployHook } from "@/lib/deploy-hook";
import { revalidatePath, unstable_cache, revalidateTag } from "next/cache";
import { updateRelatedPosts, getRelatedPosts } from "./related";
import { eventBus } from "@/lib/event-bus";

export type MicroblogListItem = {
  id: string;
  slug: string;
  contentMarkdown: string;
  createdAt: string;
  publishedAt: string | null;
  status: "draft" | "published" | "scheduled" | "archived";
};

export interface MicroblogFetchParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface MicroblogFetchResult {
  items: MicroblogListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchMicroblogsFromDb(search: string, status: string, page: number, limit: number): Promise<MicroblogFetchResult> {
  try {
    await ensureDbInitialized();
    const offset = (page - 1) * limit;

    const conditions = [];

    if (status && status !== "all") {
      conditions.push(eq(microblogs.status, status as any));
    }

    if (search && search.trim()) {
      const queryStr = `%${search.trim()}%`;
      conditions.push(
        or(
          like(microblogs.contentMarkdown, queryStr),
          like(microblogs.slug, queryStr)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const selectColumns = {
      id: microblogs.id,
      slug: microblogs.slug,
      contentMarkdown: microblogs.contentMarkdown,
      createdAt: microblogs.createdAt,
      publishedAt: microblogs.publishedAt,
      status: microblogs.status,
    };

    const [totals, items] = await Promise.all([
      db.select({ total: count() }).from(microblogs).where(whereClause),
      db
        .select(selectColumns)
        .from(microblogs)
        .where(whereClause)
        .orderBy(desc(microblogs.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totals[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  } catch (error) {
    console.error("Error fetching microblogs:", error);
    return {
      items: [],
      total: 0,
      page: 1,
      limit,
      totalPages: 1,
    };
  }
}

import { createCachedQuery, purgeTag } from "@/lib/server-cache";

const getCachedMicroblogs = createCachedQuery(
  async (search: string, status: string, page: number, limit: number) =>
    fetchMicroblogsFromDb(search, status, page, limit),
  ["microblogs-list-query"],
  {
    revalidate: 3600,
    tags: ["microblogs-list"],
  }
);

export async function getMicroblogs(filters?: MicroblogFetchParams): Promise<MicroblogFetchResult> {
  const search = filters?.search || "";
  const status = filters?.status || "all";
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.max(1, filters?.limit || 50);

  return getCachedMicroblogs(search, status, page, limit);
}

export async function getMicroblogDashboardData() {
  try {
    await ensureDbInitialized();
    const [posts, totals] = await Promise.all([
      db.select().from(microblogs).orderBy(desc(microblogs.createdAt)).limit(5),
      db.select({ total: count() }).from(microblogs),
    ]);
    return { posts, total: totals[0]?.total ?? 0 };
  } catch (error) {
    console.error("Error fetching dashboard microblogs:", error);
    return { posts: [], total: 0 };
  }
}

export async function getMicroblogById(id: string) {
  try {
    await ensureDbInitialized();
    const results = await db.select().from(microblogs).where(eq(microblogs.id, id));
    return results[0] || null;
  } catch (error) {
    console.error("Error fetching microblog by ID:", error);
    return null;
  }
}

import { syncRegistry } from "@/features/sync/registry";
import { BlueskySyncProvider } from "@/features/sync/providers/bluesky";
import { MastodonSyncProvider } from "@/features/sync/providers/mastodon";

export async function getConnectedSocialProvidersAction() {
  await ensureDbInitialized();
  const bluesky = syncRegistry.getProvider("bluesky");
  const mastodon = syncRegistry.getProvider("mastodon");

  const blueskyStatus = bluesky ? await bluesky.getStatus() : "disconnected";
  const mastodonStatus = mastodon ? await mastodon.getStatus() : "disconnected";

  return {
    blueskyConnected: blueskyStatus === "connected",
    mastodonConnected: mastodonStatus === "connected",
  };
}

export async function crossPostMicroblogToConfiguredProviders(
  contentMarkdown: string,
  images: string[] = [],
  coverImageUrl?: string | null,
  options?: { postToBluesky?: boolean; postToMastodon?: boolean }
) {
  const imageUrls = Array.from(
    new Set([...(coverImageUrl ? [coverImageUrl] : []), ...images])
  ).filter(Boolean);

  const results: Record<string, { success: boolean; error?: string; url?: string }> = {};

  // Bluesky
  if (options?.postToBluesky !== false) {
    try {
      const bluesky = syncRegistry.getProvider("bluesky") as BlueskySyncProvider | undefined;
      if (bluesky) {
        const status = await bluesky.getStatus();
        if (status === "connected") {
          const bskyRes = await bluesky.postMicroblog(contentMarkdown, imageUrls);
          results.bluesky = { success: bskyRes.success, error: bskyRes.error, url: bskyRes.uri };
        }
      }
    } catch (err: any) {
      results.bluesky = { success: false, error: err.message || String(err) };
    }
  }

  // Mastodon
  if (options?.postToMastodon !== false) {
    try {
      const mastodon = syncRegistry.getProvider("mastodon") as MastodonSyncProvider | undefined;
      if (mastodon) {
        const status = await mastodon.getStatus();
        if (status === "connected") {
          const mastoRes = await mastodon.postMicroblog(contentMarkdown, imageUrls);
          results.mastodon = { success: mastoRes.success, error: mastoRes.error, url: mastoRes.url };
        }
      }
    } catch (err: any) {
      results.mastodon = { success: false, error: err.message || String(err) };
    }
  }

  return results;
}

export async function saveMicroblog(input: MicroblogFormInput) {
  await ensureDbInitialized();
  const validated = microblogInputSchema.parse(input);
  const now = new Date().toISOString();

  const id = validated.id || crypto.randomUUID();
  const slug = validated.slug && validated.slug.trim() !== "" 
    ? validated.slug.trim() 
    : generateSlug(validated.contentMarkdown);

  const existing = validated.id ? await getMicroblogById(validated.id) : null;

  let publishedAt = validated.publishedAt ?? existing?.publishedAt ?? null;
  const isNewPublish = validated.status === "published" && existing?.status !== "published";
  if (validated.status === "published" && !publishedAt) {
    publishedAt = now;
  }

  const recordData = {
    id,
    slug,
    contentMarkdown: validated.contentMarkdown,
    status: validated.status,
    tags: JSON.stringify(validated.tags),
    coverImageUrl: validated.coverImageUrl || null,
    shortUrl: validated.shortUrl || null,
    locationId: validated.locationId || null,
    tripId: validated.tripId || null,
    images: JSON.stringify(validated.images),
    updatedAt: now,
    createdAt: validated.createdAt || existing?.createdAt || now,
    publishedAt,
  };

  if (existing) {
    await db.update(microblogs).set(recordData).where(eq(microblogs.id, id));
  } else {
    await db.insert(microblogs).values({
      ...recordData,
    });
  }

  let updatedRelated: any[] = [];
  try {
    await updateRelatedPosts(id, validated.tags, validated.contentMarkdown);
    updatedRelated = await getRelatedPosts(id);
  } catch (err) {
    console.error("Error updating related posts:", err);
  }

  let crossPostSummary: Record<string, any> | null = null;
  if (validated.status === "published") {
    await triggerVercelDeployHook();
    if (isNewPublish) {
      crossPostSummary = await crossPostMicroblogToConfiguredProviders(
        validated.contentMarkdown,
        validated.images,
        validated.coverImageUrl,
        {
          postToBluesky: validated.postToBluesky,
          postToMastodon: validated.postToMastodon,
        }
      );
    }
  }

  purgeTag("microblogs-list");
  revalidatePath("/microblog");
  revalidatePath("/");

  eventBus.emit("entity.saved", {
    type: "microblog",
    id,
    title: slug,
    subtitle: validated.contentMarkdown.slice(0, 80) + "...",
    keywords: `${slug} ${validated.tags.join(" ")} ${validated.contentMarkdown.slice(0, 200)}`,
    url: `/microblog/${id}`,
  });

  return { success: true, id, slug, relatedPosts: updatedRelated, crossPostSummary };
}

export async function deleteMicroblog(id: string) {
  try {
    await ensureDbInitialized();
    await db.delete(microblogs).where(eq(microblogs.id, id));
    purgeTag("microblogs-list");
    revalidatePath("/microblog");
    revalidatePath("/");

    eventBus.emit("entity.deleted", { type: "microblog", id });
    return { success: true };
  } catch (error) {
    console.error("Error deleting microblog:", error);
    return { success: false, error: "Failed to delete item." };
  }
}

export async function setMicroblogStatus(id: string, status: "draft" | "published" | "scheduled" | "archived") {
  await ensureDbInitialized();
  const existing = await getMicroblogById(id);
  if (!existing) return { success: false, error: "Not found" };

  const now = new Date().toISOString();
  let publishedAt = existing.publishedAt;
  const isNewPublish = status === "published" && existing.status !== "published";
  if (status === "published" && !publishedAt) {
    publishedAt = now;
  }

  await db.update(microblogs).set({
    status,
    publishedAt,
    updatedAt: now,
  }).where(eq(microblogs.id, id));

  let crossPostSummary: Record<string, any> | null = null;
  if (status === "published") {
    await triggerVercelDeployHook();
    if (isNewPublish) {
      const parsedImages = existing.images ? JSON.parse(existing.images) : [];
      crossPostSummary = await crossPostMicroblogToConfiguredProviders(
        existing.contentMarkdown,
        parsedImages,
        existing.coverImageUrl
      );
    }
  }

  purgeTag("microblogs-list");
  revalidatePath("/microblog");
  revalidatePath("/");
  return { success: true, crossPostSummary };
}

export async function fetchRelatedPosts(postId: string) {
  try {
    await ensureDbInitialized();
    return await getRelatedPosts(postId);
  } catch (err) {
    console.error("Error fetching related posts:", err);
    return [];
  }
}

export async function importMicroblogBatch(posts: {
  slug: string;
  contentMarkdown: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  status: "draft" | "published" | "scheduled" | "archived";
  coverImageUrl: string | null;
  images: string[];
}[]) {
  try {
    await ensureDbInitialized();
    const now = new Date().toISOString();
    const idsToUpdate: { id: string; tags: string[]; contentMarkdown: string }[] = [];

    await db.transaction(async (tx) => {
      for (const post of posts) {
        const existing = await tx.select().from(microblogs).where(eq(microblogs.slug, post.slug));
        const id = existing.length > 0 ? existing[0].id : crypto.randomUUID();
        
        const recordData = {
          id,
          slug: post.slug,
          contentMarkdown: post.contentMarkdown,
          status: post.status,
          tags: JSON.stringify(post.tags),
          coverImageUrl: post.coverImageUrl,
          images: JSON.stringify(post.images),
          createdAt: post.createdAt || now,
          updatedAt: post.updatedAt || now,
          publishedAt: post.publishedAt,
        };

        if (existing.length > 0) {
          await tx.update(microblogs).set({
            ...recordData,
            createdAt: existing[0].createdAt,
          }).where(eq(microblogs.id, id));
        } else {
          await tx.insert(microblogs).values(recordData);
        }

        idsToUpdate.push({ id, tags: post.tags, contentMarkdown: post.contentMarkdown });
      }
    });

    for (const item of idsToUpdate) {
      try {
        await updateRelatedPosts(item.id, item.tags, item.contentMarkdown);
      } catch (err) {
        console.error(`Error updating related posts for imported id ${item.id}:`, err);
      }
    }

    revalidatePath("/microblog");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Error importing microblog batch:", error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function recalculateRelatedAction(id: string, tagsString: string, contentMarkdown: string) {
  try {
    await ensureDbInitialized();
    let tags: string[] = [];
    if (tagsString.trim()) {
      tags = tagsString.split(",").map(t => t.trim()).filter(Boolean);
    }
    await updateRelatedPosts(id, tags, contentMarkdown);
    const related = await getRelatedPosts(id);
    return { success: true, relatedPosts: related };
  } catch (err: any) {
    console.error("Manual related posts refresh failed:", err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function deleteMicroblogsBatch(ids: string[]) {
  try {
    await ensureDbInitialized();
    await db.transaction(async (tx) => {
      for (const id of ids) {
        await tx.delete(microblogs).where(eq(microblogs.id, id));
        await tx.delete(relatedMicroblogs).where(
          or(
            eq(relatedMicroblogs.microblogId, id),
            relatedMicroblogs.relatedMicroblogId ? eq(relatedMicroblogs.relatedMicroblogId, id) : undefined as any
          )
        );
      }
    });
    revalidatePath("/microblog");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Batch delete failed:", err);
    return { success: false, error: err.message || String(err) };
  }
}
