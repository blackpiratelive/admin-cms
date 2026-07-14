"use server";

import { db, ensureDbInitialized } from "@/db";
import { jobs, JobRecord } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function enqueueJob(
  type: string,
  payload: Record<string, any> = {},
  maxAttempts = 3
): Promise<JobRecord> {
  await ensureDbInitialized();
  const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();

  const record: JobRecord = {
    id,
    type,
    payloadJson: JSON.stringify(payload),
    status: "queued",
    progress: 0,
    errorMessage: null,
    resultJson: "{}",
    attempts: 0,
    maxAttempts,
    createdAt,
    startedAt: null,
    completedAt: null,
  };

  await db.insert(jobs).values(record);
  return record;
}

export async function getRecentJobs(limit = 20): Promise<JobRecord[]> {
  await ensureDbInitialized();
  return db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

export async function updateJobStatus(
  id: string,
  status: "queued" | "running" | "completed" | "failed" | "cancelled",
  progress = 0,
  result: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  await ensureDbInitialized();
  const now = new Date().toISOString();

  const updates: Partial<JobRecord> = {
    status,
    progress,
    resultJson: JSON.stringify(result),
  };

  if (status === "running" && !updates.startedAt) {
    updates.startedAt = now;
  }
  if (status === "completed" || status === "failed" || status === "cancelled") {
    updates.completedAt = now;
  }
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }

  await db.update(jobs).set(updates).where(eq(jobs.id, id));
}
