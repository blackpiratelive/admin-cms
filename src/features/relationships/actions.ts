"use server";

import { db, ensureDbInitialized } from "@/db";
import { relationships, RelationshipRecord } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { logActivity } from "@/features/activity/actions";

export async function addRelationship(
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
  relationship: string
): Promise<RelationshipRecord> {
  await ensureDbInitialized();

  // Check if relationship already exists
  const existing = await db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.sourceType, sourceType),
        eq(relationships.sourceId, sourceId),
        eq(relationships.targetType, targetType),
        eq(relationships.targetId, targetId),
        eq(relationships.relationship, relationship)
      )
    );

  if (existing.length > 0) {
    return existing[0];
  }

  const id = `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const record = {
    id,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationship,
    createdAt,
  };

  await db.insert(relationships).values(record);
  await logActivity(
    "relationship_created",
    sourceType,
    sourceId,
    `Connected ${sourceType} to ${targetType} (${relationship})`,
    { targetType, targetId, relationship }
  );

  return record;
}

export async function removeRelationship(id: string): Promise<boolean> {
  await ensureDbInitialized();
  await db.delete(relationships).where(eq(relationships.id, id));
  return true;
}

export async function getRelationshipsForEntity(
  entityType: string,
  entityId: string
): Promise<RelationshipRecord[]> {
  await ensureDbInitialized();

  const asSource = await db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.sourceType, entityType),
        eq(relationships.sourceId, entityId)
      )
    );

  const asTarget = await db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.targetType, entityType),
        eq(relationships.targetId, entityId)
      )
    );

  return [...asSource, ...asTarget];
}
