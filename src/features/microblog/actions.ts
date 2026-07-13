"use server";

import { db, ensureDbInitialized } from "@/db";
import { microblogs, relatedMicroblogs } from "@/db/schema";
import { eq, like, and, desc, or } from "drizzle-orm";
import { generateSlug, microblogInputSchema, type MicroblogFormInput } from "./schema";
import { triggerVercelDeployHook } from "@/lib/deploy-hook";
import { revalidatePath } from "next/cache";
import { updateRelatedPosts, getRelatedPosts } from "./related";

export async function getMicroblogs(filters?: { search?: string; status?: string }) {
  try {
    await ensureDbInitialized();
    const conditions = [];

    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(microblogs.status, filters.status as any));
    }

    if (filters?.search && filters.search.trim()) {
      conditions.push(like(microblogs.contentMarkdown, `%${filters.search.trim()}%`));
    }

    const query = db
      .select()
      .from(microblogs)
      .orderBy(desc(microblogs.createdAt));

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }

    return await query;
  } catch (error) {
    console.error("Error fetching microblogs:", error);
    return [];
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

  if (validated.status === "published") {
    await triggerVercelDeployHook();
  }

  revalidatePath("/microblog");
  revalidatePath("/");
  return { success: true, id, slug, relatedPosts: updatedRelated };
}

export async function deleteMicroblog(id: string) {
  try {
    await ensureDbInitialized();
    await db.delete(microblogs).where(eq(microblogs.id, id));
    revalidatePath("/microblog");
    revalidatePath("/");
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
  if (status === "published" && !publishedAt) {
    publishedAt = now;
  }

  await db.update(microblogs).set({
    status,
    publishedAt,
    updatedAt: now,
  }).where(eq(microblogs.id, id));

  if (status === "published") {
    await triggerVercelDeployHook();
  }

  revalidatePath("/microblog");
  revalidatePath("/");
  return { success: true };
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
