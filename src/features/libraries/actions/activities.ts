"use server";

import { ensureDbInitialized, db } from "@/db";
import { activities, ActivityRecord } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function recordActivityAction(
  action: string,
  entityType: string,
  entityId: string,
  title: string,
  metadata?: Record<string, any>
) {
  await ensureDbInitialized();
  const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  await db.insert(activities).values({
    id,
    action,
    entityType,
    entityId: String(entityId),
    title,
    metadataJson: JSON.stringify(metadata || {}),
    createdAt: now,
  });

  return id;
}

export async function getActivitiesAction(limit = 20): Promise<ActivityRecord[]> {
  await ensureDbInitialized();
  return db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
}
