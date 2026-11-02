"use server";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db, ensureDbInitialized } from "@/db";
import {
  healthProfiles,
  healthProfileCollaborators,
  healthTreatments,
  healthTreatmentLogs,
  healthPhotoSessions,
  healthScalpPhotos,
  users,
  type HealthProfileRecord,
  type HealthProfileCollaboratorRecord,
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
  ParticipantSummary,
  DualCompanionProfile,
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
  purgeTag("health-hub");
  purgeTag("health-profiles");
  if (profileId) {
    purgeTag(`health-profile-${profileId}`);
  }
}

export async function refreshHealthAction(profileId?: string) {
  refreshHealth(profileId);
  return { success: true };
}

/**
 * Raw data query engine: executes queries with parallel batching, collaborator support, and multi-participant cards.
 */
async function fetchHealthHubDataRaw(
  userId: string,
  role: string,
  currentUsername: string,
  requestedProfileId?: string
): Promise<HealthHubData> {
  const isSuperAdmin = role === "superadmin";

  // 1. Fetch accessible profiles
  let rawProfiles: HealthProfileRecord[] = [];
  let userCollaborations: HealthProfileCollaboratorRecord[] = [];

  if (isSuperAdmin) {
    rawProfiles = await db
      .select()
      .from(healthProfiles)
      .orderBy(desc(healthProfiles.createdAt));
  } else {
    // Find profiles where current user is a collaborator
    userCollaborations = await db
      .select()
      .from(healthProfileCollaborators)
      .where(eq(healthProfileCollaborators.userId, userId));

    const collaboratedProfileIds = userCollaborations.map((c) => c.profileId);

    const conditions = [
      eq(healthProfiles.userId, userId),
      eq(healthProfiles.visibility, "public"),
    ];
    if (collaboratedProfileIds.length > 0) {
      conditions.push(inArray(healthProfiles.id, collaboratedProfileIds));
    }

    rawProfiles = await db
      .select()
      .from(healthProfiles)
      .where(or(...conditions))
      .orderBy(desc(healthProfiles.createdAt));
  }

  const allProfileIds = rawProfiles.map((p) => p.id);

  // 2. Fetch collaborators, treatments, photo sessions across accessible profiles in parallel (Stage 1)
  const [allCollaborators, allTreatments, allSessions] = await Promise.all([
    allProfileIds.length > 0
      ? db
          .select()
          .from(healthProfileCollaborators)
          .where(inArray(healthProfileCollaborators.profileId, allProfileIds))
          .orderBy(desc(healthProfileCollaborators.createdAt))
      : Promise.resolve([] as HealthProfileCollaboratorRecord[]),
    allProfileIds.length > 0
      ? db
          .select()
          .from(healthTreatments)
          .where(inArray(healthTreatments.profileId, allProfileIds))
          .orderBy(desc(healthTreatments.isActive), healthTreatments.name)
      : Promise.resolve([] as HealthTreatmentRecord[]),
    allProfileIds.length > 0
      ? db
          .select()
          .from(healthPhotoSessions)
          .where(inArray(healthPhotoSessions.profileId, allProfileIds))
          .orderBy(desc(healthPhotoSessions.sessionDate))
      : Promise.resolve([] as HealthPhotoSessionRecord[]),
  ]);

  const profileSummaries: HealthProfileSummary[] = rawProfiles.map((p) => {
    const isOwner = p.userId === userId;
    const isCollaborator = allCollaborators.some(
      (c) => c.profileId === p.id && c.userId === userId
    );
    const collaboratorsCount = allCollaborators.filter(
      (c) => c.profileId === p.id
    ).length;

    return {
      id: p.id,
      userId: p.userId,
      creatorUsername:
        p.creatorUsername || (p.userId === "superadmin" ? "admin" : "user"),
      name: p.name,
      visibility: p.visibility as "private" | "public",
      baselineDate: p.baselineDate,
      notes: p.notes,
      createdAt: p.createdAt,
      isOwner,
      isCollaborator,
      canEdit: isOwner || isSuperAdmin, // Only owner or superadmin can edit profile metadata / treatments!
      collaboratorsCount,
    };
  });

  // Determine active profile
  let activeProfile: HealthProfileRecord | null = null;
  if (requestedProfileId) {
    activeProfile = rawProfiles.find((p) => p.id === requestedProfileId) || null;
  }
  if (!activeProfile && rawProfiles.length > 0) {
    // Prefer owned profile, then collaborated profile, then first accessible
    activeProfile =
      rawProfiles.find((p) => p.userId === userId) ||
      rawProfiles.find((p) =>
        allCollaborators.some(
          (c) => c.profileId === p.id && c.userId === userId
        )
      ) ||
      rawProfiles[0];
  }

  if (!activeProfile) {
    return {
      profiles: profileSummaries,
      companionProfiles: [],
      activeProfile: null,
      isOwner: false,
      isCollaborator: false,
      canEdit: false,
      collaborators: [],
      participants: [],
      treatments: [],
      recentLogs: [],
      photoSessions: [],
      allPhotoSessions: [],
      weeksElapsed: 0,
      currentUsername,
      currentUserId: userId,
      isSuperAdmin,
    };
  }

  const isOwner = activeProfile.userId === userId;
  const isCollaborator = allCollaborators.some(
    (c) => c.profileId === activeProfile.id && c.userId === userId
  );
  const canEdit = isOwner || isSuperAdmin;
  const activeCollaborators = allCollaborators.filter(
    (c) => c.profileId === activeProfile.id
  );

  const allTreatmentIds = allTreatments.map((t) => t.id);
  const allSessionIds = allSessions.map((s) => s.id);

  // 3. Fetch logs & photos in parallel (Stage 2)
  const [allLogs, allPhotos] = await Promise.all([
    allTreatmentIds.length > 0
      ? db
          .select()
          .from(healthTreatmentLogs)
          .where(inArray(healthTreatmentLogs.treatmentId, allTreatmentIds))
          .orderBy(desc(healthTreatmentLogs.logDate))
      : Promise.resolve([] as HealthTreatmentLogRecord[]),
    allSessionIds.length > 0
      ? db
          .select()
          .from(healthScalpPhotos)
          .where(inArray(healthScalpPhotos.sessionId, allSessionIds))
      : Promise.resolve([] as HealthScalpPhotoRecord[]),
  ]);

  // Group photos by session
  const photosBySession = new Map<string, HealthScalpPhotoRecord[]>();
  for (const photo of allPhotos) {
    const list = photosBySession.get(photo.sessionId) || [];
    list.push(photo);
    photosBySession.set(photo.sessionId, list);
  }

  // Profile lookup map
  const profileMap = new Map(profileSummaries.map((p) => [p.id, p]));

  // All photo sessions tagged with profile and participant metadata
  const allPhotoSessionsWithPhotos: PhotoSessionWithPhotos[] = allSessions.map(
    (session) => {
      const prof = profileMap.get(session.profileId);
      return {
        ...session,
        profileName: prof?.name || "Profile",
        creatorUsername: prof?.creatorUsername || "user",
        photos: photosBySession.get(session.id) || [],
      };
    }
  );

  // Active profile treatments, logs, photo sessions
  const activeTreatments = allTreatments.filter(
    (t) => t.profileId === activeProfile.id
  );
  const activeLogs = allLogs.filter((l) => l.profileId === activeProfile.id);
  const activePhotoSessions = allPhotoSessionsWithPhotos.filter(
    (s) => s.profileId === activeProfile.id
  );

  // Build Participants for the active profile (Owner + all Collaborators)
  const rawParticipants: { userId: string; username: string; isOwner: boolean }[] = [
    {
      userId: activeProfile.userId,
      username:
        activeProfile.creatorUsername ||
        (activeProfile.userId === "superadmin" ? "admin" : "owner"),
      isOwner: true,
    },
    ...activeCollaborators.map((c) => ({
      userId: c.userId,
      username: c.username,
      isOwner: false,
    })),
  ];

  const participants: ParticipantSummary[] = rawParticipants.map((part) => {
    const isCurrentUser = part.userId === userId;
    const canLog = isSuperAdmin || isCurrentUser;

    const participantTreatments = activeTreatments.map((treatment) => {
      const stats = calculateStreakAndAdherence({
        treatmentId: treatment.id,
        timesPerDay: treatment.timesPerDay,
        startDate: treatment.startDate,
        logs: activeLogs,
        targetUserId: part.userId,
      });
      return {
        ...treatment,
        stats,
      };
    });

    const participantSessions = activePhotoSessions.filter(
      (s) => s.userId === part.userId
    );
    const latestSession = participantSessions[0];
    const latestPhoto = latestSession?.photos[0] || null;

    return {
      userId: part.userId,
      username: part.username,
      isOwner: part.isOwner,
      isCurrentUser,
      canLog,
      treatments: participantTreatments,
      latestPhoto,
      latestPhotoWeek: latestSession?.weekNumber,
    };
  });

  // Calculate current user's treatments with stats (or first participant if viewing)
  const currentUserParticipant =
    participants.find((p) => p.isCurrentUser) || participants[0];

  const activeTreatmentsWithStats =
    currentUserParticipant?.treatments ||
    activeTreatments.map((treatment) => ({
      ...treatment,
      stats: calculateStreakAndAdherence({
        treatmentId: treatment.id,
        timesPerDay: treatment.timesPerDay,
        startDate: treatment.startDate,
        logs: activeLogs,
        targetUserId: userId,
      }),
    }));

  // Build Companion Profiles for the Peer Regrowth Dashboard
  const companionProfiles: DualCompanionProfile[] = profileSummaries.map(
    (prof) => {
      const profTreatments = allTreatments.filter(
        (t) => t.profileId === prof.id
      );
      const profLogs = allLogs.filter((l) => l.profileId === prof.id);
      const profSessions = allPhotoSessionsWithPhotos.filter(
        (s) => s.profileId === prof.id
      );

      // In companion cards, show stats for the current user if they are owner/collaborator, else the profile owner
      const targetUserForCard =
        prof.userId === userId ||
        allCollaborators.some(
          (c) => c.profileId === prof.id && c.userId === userId
        )
          ? userId
          : prof.userId;

      const treatmentsWithStats = profTreatments.map((treatment) => ({
        ...treatment,
        stats: calculateStreakAndAdherence({
          treatmentId: treatment.id,
          timesPerDay: treatment.timesPerDay,
          startDate: treatment.startDate,
          logs: profLogs,
          targetUserId: targetUserForCard,
        }),
      }));

      const latestSession = profSessions[0];
      const latestPhoto = latestSession?.photos[0] || null;

      const canLogDoses =
        isSuperAdmin ||
        prof.userId === userId ||
        allCollaborators.some(
          (c) => c.profileId === prof.id && c.userId === userId
        );

      return {
        profile: prof,
        treatments: treatmentsWithStats,
        latestPhoto,
        latestPhotoWeek: latestSession?.weekNumber,
        canLogDoses,
      };
    }
  );

  const weeksElapsed = calculateWeekNumber(activeProfile.baselineDate);

  return {
    profiles: profileSummaries,
    companionProfiles,
    activeProfile,
    isOwner,
    isCollaborator,
    canEdit,
    collaborators: activeCollaborators,
    participants,
    treatments: activeTreatmentsWithStats,
    recentLogs: activeLogs,
    photoSessions: activePhotoSessions,
    allPhotoSessions: allPhotoSessionsWithPhotos,
    weeksElapsed,
    currentUsername,
    currentUserId: userId,
    isSuperAdmin,
  };
}

/**
 * Loads all accessible health profiles and dual companion data with server caching.
 */
export async function getHealthHubDataAction(
  requestedProfileId?: string
): Promise<HealthHubData> {
  await ensureDbInitialized();
  const user = await requireUser();

  const cachedFn = createCachedQuery(
    () =>
      fetchHealthHubDataRaw(
        user.userId,
        user.role,
        user.username || "admin",
        requestedProfileId
      ),
    [
      "health-hub-data",
      user.userId,
      user.role,
      user.username || "admin",
      requestedProfileId || "default",
    ],
    {
      tags: [
        "health-hub",
        `health-user-${user.userId}`,
        requestedProfileId
          ? `health-profile-${requestedProfileId}`
          : "health-profile-default",
      ],
      revalidate: 3600,
    }
  );

  return cachedFn();
}

/**
 * Fetches all registered system users (for adding collaborators).
 */
export async function getRegisteredUsersAction() {
  await ensureDbInitialized();
  await requireUser();

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .orderBy(users.username);

  return allUsers;
}

/**
 * Adds a registered user as a collaborator to a health profile.
 * Restricted strictly to profile owner or Super Admin.
 */
export async function addCollaboratorAction(
  profileId: string,
  targetUserId: string
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
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return {
      success: false,
      error: "Forbidden: Only the profile owner or Super Admin can add collaborators.",
    };
  }

  // Prevent adding owner as collaborator
  if (profile.userId === targetUserId) {
    return { success: false, error: "The profile owner is already a participant." };
  }

  // Check if target user exists in database
  const targetUserRecord = (
    await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1)
  )[0];

  const username =
    targetUserRecord?.username ||
    (targetUserId === "superadmin" ? "admin" : "collaborator");

  // Check if already a collaborator
  const existing = (
    await db
      .select({ id: healthProfileCollaborators.id })
      .from(healthProfileCollaborators)
      .where(
        and(
          eq(healthProfileCollaborators.profileId, profileId),
          eq(healthProfileCollaborators.userId, targetUserId)
        )
      )
      .limit(1)
  )[0];
  if (existing) {
    return { success: false, error: `@${username} is already a collaborator on this profile.` };
  }

  const now = new Date().toISOString();
  await db.insert(healthProfileCollaborators).values({
    id: generateId("hpc"),
    profileId,
    userId: targetUserId,
    username,
    role: "collaborator",
    createdAt: now,
    createdBy: user.username || (user.role === "superadmin" ? "admin" : "user"),
  });

  refreshHealth(profileId);
  return { success: true };
}

/**
 * Removes a collaborator from a health profile.
 * Restricted strictly to profile owner or Super Admin.
 */
export async function removeCollaboratorAction(
  profileId: string,
  collaboratorId: string
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
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return {
      success: false,
      error: "Forbidden: Only the profile owner or Super Admin can remove collaborators.",
    };
  }

  await db
    .delete(healthProfileCollaborators)
    .where(
      and(
        eq(healthProfileCollaborators.id, collaboratorId),
        eq(healthProfileCollaborators.profileId, profileId)
      )
    );

  refreshHealth(profileId);
  return { success: true };
}

/**
 * Creates a new health profile with immutable creator attribution.
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
  const creatorUsername =
    user.username || (user.role === "superadmin" ? "admin" : "user");

  await db.insert(healthProfiles).values({
    id,
    userId: user.userId,
    creatorUsername,
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
 * Updates a health profile while preserving original creator attribution.
 * Strictly restricted to profile owner or Super Admin (Collaborators CANNOT edit metadata).
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
      .select({
        id: healthProfiles.id,
        userId: healthProfiles.userId,
        creatorUsername: healthProfiles.creatorUsername,
      })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, id))
      .limit(1)
  )[0];
  if (!profile) return { success: false, error: "Profile not found." };

  if (profile.userId !== user.userId && user.role !== "superadmin") {
    return {
      success: false,
      error: "Forbidden: Only the profile owner or Super Admin can edit profile metadata.",
    };
  }

  const now = new Date().toISOString();
  const values: Partial<HealthProfileRecord> = {
    updatedAt: now,
  };
  if (input.name !== undefined) values.name = input.name.trim();
  if (input.visibility !== undefined) values.visibility = input.visibility;
  if (input.baselineDate !== undefined) values.baselineDate = input.baselineDate;
  if (input.notes !== undefined) values.notes = input.notes?.trim() || null;

  // Notice: userId and creatorUsername are strictly preserved and never overwritten!
  await db.update(healthProfiles).set(values).where(eq(healthProfiles.id, id));
  refreshHealth(id);
  return { success: true };
}

/**
 * Deletes a health profile and all related data.
 * Strictly restricted to profile owner or Super Admin.
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
    return {
      success: false,
      error: "Forbidden: Only the profile owner or Super Admin can delete this profile.",
    };
  }

  await Promise.all([
    db.delete(healthScalpPhotos).where(eq(healthScalpPhotos.profileId, id)),
    db.delete(healthPhotoSessions).where(eq(healthPhotoSessions.profileId, id)),
    db.delete(healthTreatmentLogs).where(eq(healthTreatmentLogs.profileId, id)),
    db.delete(healthTreatments).where(eq(healthTreatments.profileId, id)),
    db.delete(healthProfileCollaborators).where(eq(healthProfileCollaborators.profileId, id)),
    db.delete(healthProfiles).where(eq(healthProfiles.id, id)),
  ]);

  refreshHealth(id);
  return { success: true };
}

/**
 * Creates or updates a treatment.
 * Strictly restricted to profile owner or Super Admin.
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
    return {
      success: false,
      error: "Forbidden: Only the profile owner or Super Admin can add or edit treatments.",
    };
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
 * Strictly restricted to profile owner or Super Admin.
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
    return {
      success: false,
      error: "Forbidden: Only the profile owner or Super Admin can delete treatments.",
    };
  }

  await Promise.all([
    db.delete(healthTreatmentLogs).where(eq(healthTreatmentLogs.treatmentId, treatmentId)),
    db.delete(healthTreatments).where(eq(healthTreatments.id, treatmentId)),
  ]);

  refreshHealth(profileId);
  return { success: true };
}

/**
 * Sets dose completion for a specific participant.
 * Super Admin can log for any participant; collaborators can only log for themselves.
 */
export async function setDoseCompletionAction(input: {
  profileId: string;
  treatmentId: string;
  targetUserId: string;
  targetUsername?: string;
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
  if (!profile) {
    return { success: false, error: "Profile not found." };
  }

  // Permission: user must be logging for themselves, or be Super Admin
  const isSuperAdmin = user.role === "superadmin";
  const isSelf = user.userId === input.targetUserId;

  if (!isSelf && !isSuperAdmin) {
    return {
      success: false,
      error: "Forbidden: You can only log doses for yourself.",
    };
  }

  const now = new Date().toISOString();
  const completedDoses = Math.max(0, input.completedDoses);
  const targetUsername =
    input.targetUsername ||
    (isSelf ? user.username || "user" : "participant");

  const existing = (
    await db
      .select({ id: healthTreatmentLogs.id })
      .from(healthTreatmentLogs)
      .where(
        and(
          eq(healthTreatmentLogs.treatmentId, input.treatmentId),
          eq(healthTreatmentLogs.userId, input.targetUserId),
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
        username: targetUsername,
        updatedAt: now,
      })
      .where(eq(healthTreatmentLogs.id, existing.id));
  } else {
    await db.insert(healthTreatmentLogs).values({
      id: generateId("htl"),
      profileId: input.profileId,
      treatmentId: input.treatmentId,
      userId: input.targetUserId,
      username: targetUsername,
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
 * Saves a weekly photo session tagged with the participant's user_id and username.
 */
export async function savePhotoSessionAction(input: {
  profileId: string;
  targetUserId?: string;
  targetUsername?: string;
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
      .select({
        id: healthProfiles.id,
        baselineDate: healthProfiles.baselineDate,
        userId: healthProfiles.userId,
      })
      .from(healthProfiles)
      .where(eq(healthProfiles.id, input.profileId))
      .limit(1)
  )[0];
  if (!profile) {
    return { success: false, error: "Profile not found." };
  }

  const isSuperAdmin = user.role === "superadmin";
  const targetUserId = input.targetUserId || user.userId;
  const isSelf = user.userId === targetUserId;

  if (!isSelf && !isSuperAdmin) {
    return {
      success: false,
      error: "Forbidden: You cannot upload photos for another participant.",
    };
  }

  if (!input.photos || input.photos.length === 0) {
    return { success: false, error: "At least one scalp photo is required." };
  }

  const targetUsername =
    input.targetUsername ||
    (isSelf ? user.username || "user" : "participant");

  const now = new Date().toISOString();
  const sessionId = generateId("hps");
  const sessionDate = input.sessionDate || formatDateIso();
  const weekNumber =
    input.weekNumber || calculateWeekNumber(profile.baselineDate, sessionDate);

  await db.insert(healthPhotoSessions).values({
    id: sessionId,
    profileId: input.profileId,
    userId: targetUserId,
    username: targetUsername,
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

  const session = (
    await db
      .select({
        id: healthPhotoSessions.id,
        profileId: healthPhotoSessions.profileId,
        userId: healthPhotoSessions.userId,
      })
      .from(healthPhotoSessions)
      .where(eq(healthPhotoSessions.id, sessionId))
      .limit(1)
  )[0];
  if (!session) return { success: false, error: "Photo session not found." };

  const isSuperAdmin = user.role === "superadmin";
  const isOwner = session.userId === user.userId;

  if (!isOwner && !isSuperAdmin) {
    return {
      success: false,
      error: "Forbidden: You cannot delete another participant's photo session.",
    };
  }

  await Promise.all([
    db.delete(healthScalpPhotos).where(eq(healthScalpPhotos.sessionId, sessionId)),
    db.delete(healthPhotoSessions).where(eq(healthPhotoSessions.id, sessionId)),
  ]);

  refreshHealth(profileId);
  return { success: true };
}
