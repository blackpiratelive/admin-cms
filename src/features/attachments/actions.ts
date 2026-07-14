"use server";

import { db, ensureDbInitialized } from "@/db";
import { attachments, AttachmentRecord } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function addAttachment(
  entityType: string,
  entityId: string,
  kind: string,
  url: string,
  options: {
    mime?: string;
    width?: number;
    height?: number;
    metadata?: Record<string, any>;
  } = {}
): Promise<AttachmentRecord> {
  await ensureDbInitialized();
  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const record = {
    id,
    entityType,
    entityId,
    kind,
    url,
    mime: options.mime || null,
    width: options.width || null,
    height: options.height || null,
    metadataJson: JSON.stringify(options.metadata || {}),
    createdAt,
  };

  await db.insert(attachments).values(record);
  return record;
}

export async function getAttachmentsForEntity(
  entityType: string,
  entityId: string
): Promise<AttachmentRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.entityType, entityType),
        eq(attachments.entityId, entityId)
      )
    );
}

export async function removeAttachment(id: string): Promise<boolean> {
  await ensureDbInitialized();
  await db.delete(attachments).where(eq(attachments.id, id));
  return true;
}
