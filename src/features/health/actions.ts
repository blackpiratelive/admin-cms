"use server";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, ensureDbInitialized } from "@/db";
import {
  healthProfiles,
  healthTreatments,
  healthTreatmentLogs,
  healthPhotoSessions,
  healthScalpPhotos,
  type HealthProfileRecord,
  type HealthTreatmentRecord,
  type HealthTreatmentLogRecord,
  type HealthPhotoSessionRecord,
  type HealthScalpPhotoRecord,
} from "@/db/schema";
import { getSessionUser, type SessionUser } from "@/features/auth/session";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import {
  calculateStreakAndAdherence,
  calculateWeekNumber,
  formatDateIso,
} from "./analytics";
import type {
  HealthHubData,
  HealthProfileSummary,
  PhotoSessionWithPhotos,
  ScalpPhotoAngle,
} from "./types";

function generateId(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized: Please sign in to access the Health module.");
  }
  return user;
}

export function refreshHealth(profileId?: string) {
  purgeTag("health-hub");
  purgeTag("health-profiles");
  if (profileId) {
    purgeTag(`health-profile-${profileId}`);
  }
}

/**
 * Raw data query engine: executes queries with parallel batching.
 */
async function fetchHealthHubDataRaw(
  userId: string,
  role: string,
  requestedProfileId?: string
): Promise<HealthHubData> {
  // 1. Fetch accessible profiles
  let rawProfiles: HealthProfileRecord[] = [];
  if (role === "superadmin") {
    rawProfiles = await db
      .select()
      .from(healthProfiles)
      .orderBy(desc(healthProfiles.createdAt));
  } else {
    rawProfiles = await db
      .select()
      .from(healthProfiles)
      .where(
        or(
          eq(healthProfiles.userId, userId),
          eq(healthProfiles.visibility, "public")
        )
      )
      .orderBy(desc(healthProfiles.createdAt));
  }

  const profileSummaries: HealthProfileSummary[] = rawProfiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
    visibility: p.visibility as "private" | "public",
    baselineDate: p.baselineDate,
    notes: p.notes,
    createdAt: p.createdAt,
    isOwner: p.userId === userId || role === "superadmin",
  }));

  // Determine active profile
  let activeProfile: HealthProfileRecord | null = null;
  if (requestedProfileId) {
    activeProfile = rawProfiles.find((p) => p.id === requestedProfileId) || null;
  }
  if (!activeProfile && rawProfiles.length > 0) {
    activeProfile =
      rawProfiles.find((p) => p.userId === userId) || rawProfiles[0];
  }

  if (!activeProfile) {
    return {
      profiles: profileSummaries,
      activeProfile: null,
      isOwner: false,
      canEdit: false,
      treatments: [],
      recentLogs: [],
      photoSessions: [],
      weeksElapsed: 0,
    };
  }

  const isOwner = activeProfile.userId === userId || role === "superadmin";
  const canEdit = isOwner;

  // 2. Fetch treatments & photo sessions in parallel (Stage 1)
  const [treatments, sessions] = await Promise.all([
    db
      .select()
      .from(healthTreatments)
      .where(eq(healthTreatments.profileId, activeProfile.id))
      .orderBy(desc(healthTreatments.isActive), healthTreatments.name),
    db
      .select()
      .from(healthPhotoSessions)
      .where(eq(healthPhotoSessions.profileId, activeProfile.id))
      .orderBy(desc(healthPhotoSessions.sessionDate)),
  ]);

  const treatmentIds = treatments.map((t) => t.id);
  const sessionIds = sessions.map((s) => s.id);

  // 3. Fetch logs & photos in parallel (Stage 2)
  const [recentLogs, photos] = await Promise.all([
    treatmentIds.length > 0
      ? db
          .select()
          .from(healthTreatmentLogs)
          .where(
            and(
              eq(healthTreatmentLogs.profileId, activeProfile.id),
              inArray(healthTreatmentLogs.treatmentId, treatmentIds)
            )
          )
          .orderBy(desc(healthTreatmentLogs.logDate))
      : Promise.resolve([] as HealthTreatmentLogRecord[]),
    sessionIds.length > 0
      ? db
          .select()
          .from(healthScalpPhotos)
          .where(inArray(healthScalpPhotos.sessionId, sessionIds))
      : Promise.resolve([] as HealthScalpPhotoRecord[]),
  ]);

  // 4. Calculate stats for each treatment
  const treatmentsWithStats = treatments.map((treatment) => {
    const stats = calculateStreakAndAdherence({
      treatmentId: treatment.id,
      timesPerDay: treatment.timesPerDay,
      startDate: treatment.startDate,
      logs: recentLogs,
    });
    return {
      ...treatment,
      stats,
    };
  });

  // 5. Group photos by session
  const photosBySession = new Map<string, HealthScalpPhotoRecord[]>();
  for (const photo of photos) {
    const list = photosBySession.get(photo.sessionId) || [];
    list.push(photo);
    photosBySession.set(photo.sessionId, list);
  }

  const photoSessionsWithPhotos: PhotoSessionWithPhotos[] = sessions.map(
    (session) => ({
      ...session,
      photos: photosBySession.get(session.id) || [],
    })
  );

  const weeksElapsed = calculateWeekNumber(activeProfile.baselineDate);

  return {
    profiles: profileSummaries,
    activeProfile,
    isOwner,
    canEdit,
    treatments: treatmentsWithStats,
    recentLogs,
    photoSessions: photoSessionsWithPhotos,
    weeksElapsed,
  };
}

/**
 * Loads all accessible health profiles and active profile details with server caching.
 */
export async function getHealthHubDataAction(
  requestedProfileId?: string
): Promise<HealthHubData> {
  await ensureDbInitialized();
  const user = await requireUser();

  const cachedFn = createCachedQuery(
    () => fetchHealthHubDataRaw(user.userId, user.role, requestedProfileId),
    ["health-hub-data", user.userId, user.role, requestedProfileId || "default"],
    {
      tags: [
        "health-hub",
        `health-user-${user.userId}`,
        requestedProfileId ? `health-profile-${requestedProfileId}` : "health-profile-default",
      ],
      revalidate: 3600,
    }
  );

  return cachedFn();
}

/**
 * Creates a new health profile.
 */
export async function createHealthProfileAction(input: {
  name: string;
  visibility?: "private" | "public";
  baselineDate: string;
  notes?: string;
}) {
  await ensureDbInitialized();
  const user = await requireUser();

  const name = input.name.trim();
  if (!name) return { success: false, error: "Profile name is required." };
  if (!input.baselineDate) {
    return { success: false, error: "Baseline date is required." };
  }

  const now = new Date().toISOString();
  const id = generateId("hp");

  await db.insert(healthProfiles).values({
    id,
    userId: user.userId,
    name,
    visibility: input.visibility || "private",
    baselineDate: input.baselineDate,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  refreshHealth(id);
  return { success: true, profileId: id };
}

/**
 * Updates a health profile.
 */
export async function updateHealthProfileAction(
  id: string,
  input: {
    name?: string;
    visibility?: "private" | "public";
    baselineDate?: string;
    notes?: string;
  }
) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, id))
      .limit(1)
  )[0];
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return { success: false, error: "Forbidden: You do not own this profile." };
  }

  const now = new Date().toISOString();
  const values: Partial<HealthProfileRecord> = {
    updatedAt: now,
  };
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.visibility !== undefined) values.visibility = input.visibility;
  if (input.baselineDate !== undefined) values.baselineDate = input.baselineDate;
  if (input.notes !== undefined) values.notes = input.notes?.trim() || null;

  await db.update(healthProfiles).set(values).where(eq(healthProfiles.id, id));
  refreshHealth(id);
  return { success: true };
}

/**
 * Deletes a health profile and all related data.
 */
export async function deleteHealthProfileAction(id: string) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, id))
      .limit(1)
  )[0];
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return { success: false, error: "Forbidden: You do not own this profile." };
  }

  await Promise.all([
    db.delete(healthScalpPhotos).where(eq(healthScalpPhotos.profileId, id)),
    db.delete(healthPhotoSessions).where(eq(healthPhotoSessions.profileId, id)),
    db.delete(healthTreatmentLogs).where(eq(healthTreatmentLogs.profileId, id)),
    db.delete(healthTreatments).where(eq(healthTreatments.profileId, id)),
    db.delete(healthProfiles).where(eq(healthProfiles.id, id)),
  ]);

  refreshHealth(id);
  return { success: true };
}

/**
 * Creates or updates a treatment (e.g. Minoxidil 5%).
 */
export async function saveTreatmentAction(input: {
  id?: string;
  profileId: string;
  name: string;
  timesPerDay: number;
  startDate: string;
  isActive?: boolean;
  notes?: string;
}) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
      .limit(1)
  )[0];
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  const name = input.name.trim();
  if (!name) return { success: false, error: "Treatment name is required." };
  const timesPerDay = Math.max(1, Math.min(6, input.timesPerDay || 1));
  const startDate = input.startDate || formatDateIso();
  const now = new Date().toISOString();

  if (input.id) {
    await db
      .update(healthTreatments)
      .set({
        name,
        timesPerDay,
        startDate,
        isActive: input.isActive === false ? 0 : 1,
        notes: input.notes?.trim() || null,
        updatedAt: now,
      })
      .where(eq(healthTreatments.id, input.id));
  } else {
    const id = generateId("ht");
    await db.insert(healthTreatments).values({
      id,
      profileId: input.profileId,
      name,
      timesPerDay,
      startDate,
      isActive: 1,
      notes: input.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  refreshHealth(input.profileId);
  return { success: true };
}

/**
 * Deletes a treatment.
 */
export async function deleteTreatmentAction(profileId: string, treatmentId: string) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, profileId))
      .limit(1)
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  await Promise.all([
    db.delete(healthTreatmentLogs).where(eq(healthTreatmentLogs.treatmentId, treatmentId)),
    db.delete(healthTreatments).where(eq(healthTreatments.id, treatmentId)),
  ]);

  refreshHealth(profileId);
  return { success: true };
}

/**
 * Toggles or sets dose completion for a given treatment and date.
 */
export async function setDoseCompletionAction(input: {
  profileId: string;
  treatmentId: string;
  logDate: string;
  completedDoses: number;
}) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
      .limit(1)
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  const now = new Date().toISOString();
  const completedDoses = Math.max(0, input.completedDoses);

  const existing = (
    await db
      .select({ id: healthTreatmentLogs.id })
      .from(healthTreatmentLogs)
      .where(
        and(
          eq(healthTreatmentLogs.treatmentId, input.treatmentId),
          eq(healthTreatmentLogs.logDate, input.logDate)
        )
      )
      .limit(1)
  )[0];

  if (existing) {
    await db
      .update(healthTreatmentLogs)
      .set({
        completedDoses,
        updatedAt: now,
      })
      .where(eq(healthTreatmentLogs.id, existing.id));
  } else {
    await db.insert(healthTreatmentLogs).values({
      id: generateId("htl"),
      profileId: input.profileId,
      treatmentId: input.treatmentId,
      logDate: input.logDate,
      completedDoses,
      createdAt: now,
      updatedAt: now,
    });
  }

  refreshHealth(input.profileId);
  return { success: true, completedDoses };
}

/**
 * Saves a weekly photo session and its uploaded photos.
 */
export async function savePhotoSessionAction(input: {
  profileId: string;
  sessionDate: string;
  weekNumber?: number;
  notes?: string;
  photos: {
    angle: ScalpPhotoAngle;
    cloudinaryUrl: string;
    cloudinaryPublicId: string;
  }[];
}) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, baselineDate: healthProfiles.baselineDate, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
      .limit(1)
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  if (!input.photos || input.photos.length === 0) {
    return { success: false, error: "At least one scalp photo is required." };
  }

  const now = new Date().toISOString();
  const sessionId = generateId("hps");
  const sessionDate = input.sessionDate || formatDateIso();
  const weekNumber =
    input.weekNumber || calculateWeekNumber(profile.baselineDate, sessionDate);

  await db.insert(healthPhotoSessions).values({
    id: sessionId,
    profileId: input.profileId,
    sessionDate,
    weekNumber,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  const photoInserts = input.photos.map((photo) =>
    db.insert(healthScalpPhotos).values({
      id: generateId("hsp"),
      sessionId,
      profileId: input.profileId,
      angle: photo.angle,
      cloudinaryUrl: photo.cloudinaryUrl,
      cloudinaryPublicId: photo.cloudinaryPublicId,
      createdAt: now,
    })
  );

  await Promise.all(photoInserts);

  refreshHealth(input.profileId);
  return { success: true, sessionId };
}

/**
 * Deletes a photo session and its photos.
 */
export async function deletePhotoSessionAction(
  profileId: string,
  sessionId: string
) {
  await ensureDbInitialized();
  const user = await requireUser();

  const profile = (
    await db
      .select({ id: healthProfiles.id, userId: healthProfiles.userId })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, profileId))
      .limit(1)
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  await Promise.all([
    db.delete(healthScalpPhotos).where(eq(healthScalpPhotos.sessionId, sessionId)),
    db.delete(healthPhotoSessions).where(eq(healthPhotoSessions.id, sessionId)),
  ]);

  refreshHealth(profileId);
  return { success: true };
}
