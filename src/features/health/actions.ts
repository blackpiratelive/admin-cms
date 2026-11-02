"use server";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
import { purgeTag } from "@/lib/server-cache";
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

function refreshHealth(profileId?: string) {
  purgeTag("health-profiles");
  if (profileId) {
    purgeTag(`health-profile-${profileId}`);
  }
  try {
    revalidatePath("/health");
  } catch {}
}

/**
 * Loads all accessible health profiles for the current user and details for the active profile.
 */
export async function getHealthHubDataAction(
  requestedProfileId?: string
): Promise<HealthHubData> {
  await ensureDbInitialized();
  const user = await requireUser();

  // 1. Fetch accessible profiles:
  // - If superadmin: can access all profiles
  // - If regular user: profiles owned by user OR visibility === 'public'
  let rawProfiles: HealthProfileRecord[] = [];
  if (user.role === "superadmin") {
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
          eq(healthProfiles.userId, user.userId),
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
    isOwner: p.userId === user.userId || user.role === "superadmin",
  }));

  // Determine active profile
  let activeProfile: HealthProfileRecord | null = null;
  if (requestedProfileId) {
    activeProfile = rawProfiles.find((p) => p.id === requestedProfileId) || null;
  }
  if (!activeProfile && rawProfiles.length > 0) {
    // Default to first owned profile, otherwise first public
    activeProfile =
      rawProfiles.find((p) => p.userId === user.userId) || rawProfiles[0];
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

  const isOwner =
    activeProfile.userId === user.userId || user.role === "superadmin";
  const canEdit = isOwner;

  // 2. Fetch active treatments
  const treatments = await db
    .select()
    .from(healthTreatments)
    .where(eq(healthTreatments.profileId, activeProfile.id))
    .orderBy(desc(healthTreatments.isActive), healthTreatments.name);

  // 3. Fetch treatment logs (last 90 days for accurate streaks and adherence)
  const treatmentIds = treatments.map((t) => t.id);
  let recentLogs: HealthTreatmentLogRecord[] = [];
  if (treatmentIds.length > 0) {
    recentLogs = await db
      .select()
      .from(healthTreatmentLogs)
      .where(
        and(
          eq(healthTreatmentLogs.profileId, activeProfile.id),
          inArray(healthTreatmentLogs.treatmentId, treatmentIds)
        )
      )
      .orderBy(desc(healthTreatmentLogs.logDate));
  }

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

  // 5. Fetch photo sessions and their photos
  const sessions = await db
    .select()
    .from(healthPhotoSessions)
    .where(eq(healthPhotoSessions.profileId, activeProfile.id))
    .orderBy(desc(healthPhotoSessions.sessionDate));

  const sessionIds = sessions.map((s) => s.id);
  let photos: HealthScalpPhotoRecord[] = [];
  if (sessionIds.length > 0) {
    photos = await db
      .select()
      .from(healthScalpPhotos)
      .where(inArray(healthScalpPhotos.sessionId, sessionIds));
  }

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
    await db.select().from(healthProfiles).where(eq(healthProfiles.id, id))
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
    await db.select().from(healthProfiles).where(eq(healthProfiles.id, id))
  )[0];
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return { success: false, error: "Forbidden: You do not own this profile." };
  }

  await db.delete(healthScalpPhotos).where(eq(healthScalpPhotos.profileId, id));
  await db.delete(healthPhotoSessions).where(eq(healthPhotoSessions.profileId, id));
  await db.delete(healthTreatmentLogs).where(eq(healthTreatmentLogs.profileId, id));
  await db.delete(healthTreatments).where(eq(healthTreatments.profileId, id));
  await db.delete(healthProfiles).where(eq(healthProfiles.id, id));

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
      .select()
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
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
      .select()
      .from(healthProfiles)
      .where(eq(healthProfiles.id, profileId))
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  await db
    .delete(healthTreatmentLogs)
    .where(eq(healthTreatmentLogs.treatmentId, treatmentId));
  await db.delete(healthTreatments).where(eq(healthTreatments.id, treatmentId));

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
      .select()
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  const now = new Date().toISOString();
  const completedDoses = Math.max(0, input.completedDoses);

  const existing = (
    await db
      .select()
      .from(healthTreatmentLogs)
      .where(
        and(
          eq(healthTreatmentLogs.treatmentId, input.treatmentId),
          eq(healthTreatmentLogs.logDate, input.logDate)
        )
      )
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
      .select()
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
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

  for (const photo of input.photos) {
    await db.insert(healthScalpPhotos).values({
      id: generateId("hsp"),
      sessionId,
      profileId: input.profileId,
      angle: photo.angle,
      cloudinaryUrl: photo.cloudinaryUrl,
      cloudinaryPublicId: photo.cloudinaryPublicId,
      createdAt: now,
    });
  }

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
      .select()
      .from(healthProfiles)
      .where(eq(healthProfiles.id, profileId))
  )[0];
  if (!profile || (profile.userId !== user.userId && user.role !== "superadmin")) {
    return { success: false, error: "Forbidden: You cannot edit this profile." };
  }

  await db
    .delete(healthScalpPhotos)
    .where(eq(healthScalpPhotos.sessionId, sessionId));
  await db
    .delete(healthPhotoSessions)
    .where(eq(healthPhotoSessions.id, sessionId));

  refreshHealth(profileId);
  return { success: true };
}
