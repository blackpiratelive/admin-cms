"use server";

import { db, ensureDbInitialized } from "@/db";
import { activities, ActivityRecord } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function logActivity(
  action: string,
  entityType: string,
  entityId: string,
  title: string,
  metadata: Record<string, any> = {}
): Promise<ActivityRecord> {
  await ensureDbInitialized();
  const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const newActivity = {
    id,
    action,
    entityType,
    entityId,
    title,
    metadataJson: JSON.stringify(metadata),
    createdAt,
  };

  await db.insert(activities).values(newActivity);
  revalidatePath("/");
  return newActivity;
}

export async function getRecentActivities(limit = 20): Promise<ActivityRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(activities)
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}
