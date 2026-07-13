"use server";

import { db, ensureDbInitialized } from "@/db";
import { microblogs } from "@/db/schema";
import { eq, like, and, desc } from "drizzle-orm";
import { generateSlug, microblogInputSchema, type MicroblogFormInput } from "./schema";
import { triggerVercelDeployHook } from "@/lib/deploy-hook";
import { revalidatePath } from "next/cache";

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

  let publishedAt = validated.publishedAt;
  if (validated.status === "published" && (!publishedAt || !existing?.publishedAt)) {
    publishedAt = now;
  }

  const recordData = {
    id,
    slug,
    contentMarkdown: validated.contentMarkdown,
    status: validated.status,
    tags: JSON.stringify(validated.tags),
    coverImageUrl: validated.coverImageUrl || null,
    updatedAt: now,
    publishedAt,
  };

  if (existing) {
    await db.update(microblogs).set(recordData).where(eq(microblogs.id, id));
  } else {
    await db.insert(microblogs).values({
      ...recordData,
      createdAt: now,
    });
  }

  if (validated.status === "published") {
    await triggerVercelDeployHook();
  }

  revalidatePath("/microblog");
  revalidatePath("/");
  return { success: true, id, slug };
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
