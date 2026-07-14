"use server";

import { ensureDbInitialized, db } from "@/db";
import { collections, collectionItems, CollectionRecord } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getCollectionsAction(): Promise<CollectionRecord[]> {
  await ensureDbInitialized();
  return db.select().from(collections).orderBy(desc(collections.createdAt));
}

export async function createCollectionAction(
  name: string,
  description?: string,
  color?: string,
  icon?: string
) {
  await ensureDbInitialized();
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-");
  const id = `col_${Date.now()}`;
  const now = new Date().toISOString();

  const existing = await db.select().from(collections).where(eq(collections.slug, slug)).limit(1);
  if (existing[0]) {
    return { success: true, id: existing[0].id };
  }

  await db.insert(collections).values({
    id,
    name: name.trim(),
    slug,
    description: description?.trim() || null,
    color: color || "#ff6600",
    icon: icon || "Folder",
    createdAt: now,
    updatedAt: now,
  });

  try { revalidatePath("/libraries/collections"); } catch {}
  return { success: true, id };
}

export async function deleteCollectionAction(id: string) {
  await ensureDbInitialized();
  await db.delete(collectionItems).where(eq(collectionItems.collectionId, id));
  await db.delete(collections).where(eq(collections.id, id));
  try { revalidatePath("/libraries/collections"); } catch {}
  return { success: true };
}

export async function addItemToCollectionAction(
  collectionId: string,
  itemType: string,
  itemId: string | number
) {
  await ensureDbInitialized();
  const itemIdStr = String(itemId);
  const id = `${collectionId}_${itemType}_${itemIdStr}`;
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.id, id))
    .limit(1);

  if (!existing[0]) {
    await db.insert(collectionItems).values({
      id,
      collectionId,
      itemType,
      itemId: itemIdStr,
      addedAt: now,
    });
  }

  try { revalidatePath("/libraries"); } catch {}
  return { success: true };
}

export async function removeItemFromCollectionAction(
  collectionId: string,
  itemType: string,
  itemId: string | number
) {
  await ensureDbInitialized();
  const itemIdStr = String(itemId);
  const id = `${collectionId}_${itemType}_${itemIdStr}`;

  await db.delete(collectionItems).where(eq(collectionItems.id, id));
  try { revalidatePath("/libraries"); } catch {}
  return { success: true };
}

export async function getItemCollectionsAction(
  itemType: string,
  itemId: string | number
): Promise<CollectionRecord[]> {
  await ensureDbInitialized();
  const itemIdStr = String(itemId);

  const items = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.itemType, itemType), eq(collectionItems.itemId, itemIdStr)));

  if (items.length === 0) return [];

  const collectionIds = items.map((i) => i.collectionId);
  const results: CollectionRecord[] = [];

  for (const cId of collectionIds) {
    const res = await db.select().from(collections).where(eq(collections.id, cId)).limit(1);
    if (res[0]) results.push(res[0]);
  }

  return results;
}
