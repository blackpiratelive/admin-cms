"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  HeartPulse,
  Flame,
  Award,
  Calendar,
  Camera,
  Plus,
  Lock,
  Globe,
  Trash2,
  Edit2,
  CheckCircle2,
  Sparkles,
  Users,
  Eye,
  Check,
  UserPlus,
  Shield,
  X,
} from "lucide-react";
import {
  setDoseCompletionAction,
  deleteHealthProfileAction,
  deleteTreatmentAction,
  deletePhotoSessionAction,
  removeCollaboratorAction,
  getHealthHubDataAction,
} from "../actions";
import { formatDateIso, shiftDateIso } from "../analytics";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";
import { notify } from "@/lib/notifications";
import { ProfileModal } from "./ProfileModal";
import { TreatmentModal } from "./TreatmentModal";
import { PhotoSessionModal } from "./PhotoSessionModal";
import { PhotoComparisonModal } from "./PhotoComparisonModal";
import { AddCollaboratorModal } from "./AddCollaboratorModal";
import type { HealthHubData } from "../types";
import type { HealthTreatmentRecord, HealthScalpPhotoRecord } from "@/db/schema";

interface HealthDashboardProps {
  initialData: HealthHubData;
}

export function HealthDashboard({ initialData }: HealthDashboardProps) {
  const router = useRouter();
  const activeProfileId = initialData.activeProfile?.id || "default";
  const cacheKey = `health_cache_${activeProfileId}`;

  // Initialize state with client browser cache fallback for 0ms instant paint
  const [data, setData] = useState<HealthHubData>(() => {
    const cached = getBrowserCache<HealthHubData>(cacheKey);
    return cached && cached.activeProfile?.id === initialData.activeProfile?.id
      ? cached
      : initialData;
  });

  const [selectedDate, setSelectedDate] = useState<string>(formatDateIso());
  const [activeTab, setActiveTab] = useState<"regimen" | "photos">("regimen");
  const [selectedPhotoParticipant, setSelectedPhotoParticipant] =
    useState<string>("all");

  // Keep client cache in sync whenever data changes
  useEffect(() => {
    setData(initialData);
    setBrowserCache(cacheKey, initialData);
  }, [initialData, cacheKey]);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] =
    useState<HealthTreatmentRecord | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [comparisonPhoto, setComparisonPhoto] =
    useState<HealthScalpPhotoRecord | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isAddCollaboratorOpen, setIsAddCollaboratorOpen] = useState(false);

  // Debounce ref for dose updates
  const pendingDoseUpdates = useRef<
    Map<string, { timeoutId: NodeJS.Timeout; completedDoses: number }>
  >(new Map());

  const {
    profiles,
    companionProfiles,
    activeProfile,
    isOwner,
    isCollaborator,
    canEdit,
    collaborators = [],
    participants = [],
    treatments = [],
    recentLogs = [],
    photoSessions = [],
    allPhotoSessions = [],
    weeksElapsed = 1,
    currentUsername = "user",
    currentUserId = "",
    isSuperAdmin = false,
  } = data;

  // Background refresh data without full-page reloads
  const refreshDataInBackground = async () => {
    try {
      const fresh = await getHealthHubDataAction(activeProfile?.id);
      setData(fresh);
      setBrowserCache(
        `health_cache_${fresh.activeProfile?.id || "default"}`,
        fresh
      );
    } catch {}
  };

  // Switch active profile with instant cache lookup
  const handleProfileChange = (profileId: string) => {
    const cached = getBrowserCache<HealthHubData>(`health_cache_${profileId}`);
    if (cached) {
      setData(cached);
    }
    router.push(`/health?profile=${profileId}`);
  };

  // Instant 0ms dose toggle with background write for specific participant
  const handleToggleDose = (
    profileId: string,
    treatmentId: string,
    doseIndex: number,
    timesPerDay: number,
    canLog: boolean,
    targetUserId?: string,
    targetUsername?: string
  ) => {
    if (!canLog) return;

    const tUserId = targetUserId || currentUserId;
    const tUsername = targetUsername || currentUsername;

    const currentLog = recentLogs.find(
      (l) =>
        l.treatmentId === treatmentId &&
        l.logDate === selectedDate &&
        l.userId === tUserId
    );
    const currentCompleted = currentLog?.completedDoses || 0;

    // Toggle: if clicked dose is already checked, revert to that index; if unchecked, set to doseIndex + 1
    const newCompletedDoses =
      currentCompleted > doseIndex ? doseIndex : doseIndex + 1;

    // 1. Optimistic UI update immediately (0ms perceived latency)
    setData((prev) => {
      const updatedLogs = [...prev.recentLogs];
      const existingIdx = updatedLogs.findIndex(
        (l) =>
          l.treatmentId === treatmentId &&
          l.logDate === selectedDate &&
          l.userId === tUserId
      );

      if (existingIdx >= 0) {
        updatedLogs[existingIdx] = {
          ...updatedLogs[existingIdx],
          completedDoses: newCompletedDoses,
          username: tUsername,
        };
      } else {
        updatedLogs.unshift({
          id: `temp_${Date.now()}`,
          profileId,
          treatmentId,
          userId: tUserId,
          username: tUsername,
          logDate: selectedDate,
          completedDoses: newCompletedDoses,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Update participant stats optimistically
      const updatedParticipants = (prev.participants || []).map((part) => {
        if (part.userId !== tUserId) return part;
        const pTreatments = part.treatments.map((t) => {
          if (t.id !== treatmentId) return t;
          const isToday = selectedDate === formatDateIso();
          const willBeCompliant = newCompletedDoses >= t.timesPerDay;
          const wasCompliant = t.stats.isTodayCompliant;

          let streakDelta = 0;
          if (isToday) {
            if (willBeCompliant && !wasCompliant) streakDelta = 1;
            if (!willBeCompliant && wasCompliant) streakDelta = -1;
          }

          return {
            ...t,
            stats: {
              ...t.stats,
              todayCompletedDoses: isToday
                ? newCompletedDoses
                : t.stats.todayCompletedDoses,
              isTodayCompliant: isToday
                ? willBeCompliant
                : t.stats.isTodayCompliant,
              currentStreak: Math.max(0, t.stats.currentStreak + streakDelta),
            },
          };
        });
        return {
          ...part,
          treatments: pTreatments,
        };
      });

      // Update main treatment list if active user is target
      const updatedTreatments = prev.treatments.map((t) => {
        if (t.id !== treatmentId || tUserId !== currentUserId) return t;
        const isToday = selectedDate === formatDateIso();
        const willBeCompliant = newCompletedDoses >= t.timesPerDay;
        const wasCompliant = t.stats.isTodayCompliant;

        let streakDelta = 0;
        if (isToday) {
          if (willBeCompliant && !wasCompliant) streakDelta = 1;
          if (!willBeCompliant && wasCompliant) streakDelta = -1;
        }

        return {
          ...t,
          stats: {
            ...t.stats,
            todayCompletedDoses: isToday
              ? newCompletedDoses
              : t.stats.todayCompletedDoses,
            isTodayCompliant: isToday
              ? willBeCompliant
              : t.stats.isTodayCompliant,
            currentStreak: Math.max(0, t.stats.currentStreak + streakDelta),
          },
        };
      });

      // Update companion profiles list as well
      const updatedCompanion = prev.companionProfiles.map((comp) => {
        if (comp.profile.id !== profileId) return comp;
        const compTreatments = comp.treatments.map((t) => {
          if (t.id !== treatmentId) return t;
          const isToday = selectedDate === formatDateIso();
          return {
            ...t,
            stats: {
              ...t.stats,
              todayCompletedDoses: isToday
                ? newCompletedDoses
                : t.stats.todayCompletedDoses,
              isTodayCompliant: isToday
                ? newCompletedDoses >= t.timesPerDay
                : t.stats.isTodayCompliant,
            },
          };
        });
        return {
          ...comp,
          treatments: compTreatments,
        };
      });

      const nextData: HealthHubData = {
        ...prev,
        recentLogs: updatedLogs,
        participants: updatedParticipants,
        treatments: updatedTreatments,
        companionProfiles: updatedCompanion,
      };

      setBrowserCache(cacheKey, nextData);
      return nextData;
    });

    // 2. Debounce and execute DB write in background
    const updateKey = `${treatmentId}_${tUserId}_${selectedDate}`;
    const existingTimer = pendingDoseUpdates.current.get(updateKey);
    if (existingTimer) {
      clearTimeout(existingTimer.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      pendingDoseUpdates.current.delete(updateKey);

      notify.bg({
        task: () =>
          setDoseCompletionAction({
            profileId,
            treatmentId,
            targetUserId: tUserId,
            targetUsername: tUsername,
            logDate: selectedDate,
            completedDoses: newCompletedDoses,
          }),
        errorMessage: `Failed to sync dose update for @${tUsername}.`,
        onError: () => {
          refreshDataInBackground();
        },
      });
    }, 250);

    pendingDoseUpdates.current.set(updateKey, {
      timeoutId,
      completedDoses: newCompletedDoses,
    });
  };

  // Instant remove collaborator in background
  const handleRemoveCollaborator = (
    collaboratorId: string,
    collaboratorUsername: string
  ) => {
    if (!activeProfile) return;
    if (
      !confirm(
        `Remove @${collaboratorUsername} from profile "${activeProfile.name}"? They will lose access to log against this profile.`
      )
    ) {
      return;
    }

    setData((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((c) => c.id !== collaboratorId),
      participants: prev.participants.filter(
        (p) => p.username !== collaboratorUsername
      ),
    }));

    notify.bg({
      title: "Remove Collaborator",
      loadingMessage: `Removing @${collaboratorUsername} in background...`,
      successMessage: `@${collaboratorUsername} removed from collaborators.`,
      errorMessage: (err) =>
        `Failed to remove collaborator: ${err?.message || String(err)}`,
      task: () => removeCollaboratorAction(activeProfile.id, collaboratorId),
      onSuccess: () => {
        refreshDataInBackground();
      },
    });
  };

  // Instant delete profile in background
  const handleDeleteProfile = () => {
    if (!activeProfile) return;
    if (
      !confirm(
        `Are you sure you want to delete profile "${activeProfile.name}"? All associated treatments, logs, and photos will be permanently deleted.`
      )
    ) {
      return;
    }

    const deletedId = activeProfile.id;
    const remainingProfiles = profiles.filter((p) => p.id !== deletedId);

    setData((prev) => ({
      ...prev,
      profiles: remainingProfiles,
      companionProfiles: prev.companionProfiles.filter(
        (c) => c.profile.id !== deletedId
      ),
      activeProfile: remainingProfiles[0] ? prev.activeProfile : null,
    }));

    notify.bg({
      title: "Delete Profile",
      loadingMessage: `Deleting profile '${activeProfile.name}' in background...`,
      successMessage: `Profile '${activeProfile.name}' deleted.`,
      errorMessage: (err) =>
        `Failed to delete profile: ${err?.message || String(err)}`,
      task: () => deleteHealthProfileAction(deletedId),
      onSuccess: () => {
        router.push("/health");
        router.refresh();
      },
    });
  };

  // Instant delete treatment in background
  const handleDeleteTreatment = (treatmentId: string, name: string) => {
    if (!activeProfile) return;
    if (
      !confirm(
        `Delete treatment "${name}"? Historical logs will also be removed.`
      )
    ) {
      return;
    }

    setData((prev) => {
      const nextData: HealthHubData = {
        ...prev,
        treatments: prev.treatments.filter((t) => t.id !== treatmentId),
        recentLogs: prev.recentLogs.filter(
          (l) => l.treatmentId !== treatmentId
        ),
      };
      setBrowserCache(cacheKey, nextData);
      return nextData;
    });

    notify.bg({
      title: "Delete Treatment",
      successMessage: `Deleted treatment '${name}'.`,
      errorMessage: "Failed to delete treatment.",
      task: () => deleteTreatmentAction(activeProfile.id, treatmentId),
    });
  };

  // Instant delete photo session in background
  const handleDeletePhotoSession = (sessionId: string, week: number) => {
    if (!activeProfile) return;
    if (!confirm(`Delete Week ${week} photo session?`)) return;

    setData((prev) => {
      const nextData: HealthHubData = {
        ...prev,
        photoSessions: prev.photoSessions.filter((s) => s.id !== sessionId),
        allPhotoSessions: prev.allPhotoSessions.filter(
          (s) => s.id !== sessionId
        ),
      };
      setBrowserCache(cacheKey, nextData);
      return nextData;
    });

    notify.bg({
      title: "Delete Photo Session",
      successMessage: `Deleted Week ${week} photo session.`,
      errorMessage: "Failed to delete photo session.",
      task: () => deletePhotoSessionAction(activeProfile.id, sessionId),
    });
  };

  // 7-day strip dates
  const todayIso = formatDateIso();
  const past7Days = Array.from({ length: 7 }, (_, i) =>
    shiftDateIso(todayIso, -i)
  );

  // Filter photo sessions by selected participant
  const displayedPhotoSessions = photoSessions.filter((s) => {
    if (selectedPhotoParticipant === "all") return true;
    return s.userId === selectedPhotoParticipant;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "8px",
              background: "rgba(249, 115, 22, 0.12)",
              color: "var(--accent-primary, #f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HeartPulse size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: "22px" }}>
                Health & Regrowth Companion
              </h1>
            </div>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Logged in as <strong>@{currentUsername}</strong> {isSuperAdmin ? "(Super Admin)" : ""} • Shared peer tracker & collaborator journeys
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {allPhotoSessions.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
              }}
              onClick={() => {
                setComparisonPhoto(null);
                setIsComparisonOpen(true);
              }}
            >
              <Sparkles size={15} />
              <span>Compare Journeys</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
            }}
            onClick={() => setIsProfileModalOpen(true)}
          >
            <Plus size={15} />
            <span>New Profile</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: SHARED DUAL DASHBOARD (COMPANION CARDS) */}
      {companionProfiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <Users size={16} />
              <span>Peer Regrowth Dashboard</span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {companionProfiles.length} active {companionProfiles.length === 1 ? "journey" : "journeys"}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                companionProfiles.length === 1
                  ? "1fr"
                  : "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {companionProfiles.map((comp) => {
              const isSelected = comp.profile.id === activeProfile?.id;
              const bestStreak = comp.treatments.reduce(
                (max, t) => Math.max(max, t.stats.currentStreak),
                0
              );
              const avgAdherence =
                comp.treatments.length > 0
                  ? Math.round(
                      comp.treatments.reduce(
                        (acc, t) => acc + t.stats.adherenceRate30d,
                        0
                      ) / comp.treatments.length
                    )
                  : 0;

              return (
                <div
                  key={comp.profile.id}
                  style={{
                    background: "var(--bg-card)",
                    border: `2px solid ${
                      isSelected
                        ? "var(--accent-primary, #f97316)"
                        : "var(--border-color)"
                    }`,
                    borderRadius: "10px",
                    padding: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    boxShadow: isSelected
                      ? "0 4px 16px rgba(249, 115, 22, 0.12)"
                      : "none",
                  }}
                >
                  {/* Companion Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: 700,
                          }}
                        >
                          {comp.profile.name}
                        </h3>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "10px",
                            background:
                              comp.profile.creatorUsername === "admin"
                                ? "rgba(249, 115, 22, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                            color:
                              comp.profile.creatorUsername === "admin"
                                ? "var(--accent-primary, #f97316)"
                                : "var(--accent-blue, #3b82f6)",
                          }}
                        >
                          @{comp.profile.creatorUsername}
                        </span>
                        {comp.profile.collaboratorsCount > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(168, 85, 247, 0.12)",
                              color: "var(--accent-purple, #a855f7)",
                              fontWeight: 600,
                            }}
                          >
                            +{comp.profile.collaboratorsCount} collaborator{comp.profile.collaboratorsCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          marginTop: "3px",
                        }}
                      >
                        Started: {comp.profile.baselineDate}
                        {comp.profile.visibility === "private"
                          ? " • 🔒 Private"
                          : " • 🌐 Public"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {!comp.canLogDoses && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: "rgba(100, 116, 139, 0.15)",
                            color: "var(--text-muted)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Eye size={11} /> View Only
                        </span>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                        onClick={() => handleProfileChange(comp.profile.id)}
                      >
                        {isSelected ? "Active Focus" : "Focus"}
                      </button>
                    </div>
                  </div>

                  {/* Companion Metrics Strip */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "8px",
                      background: "var(--bg-main)",
                      padding: "10px",
                      borderRadius: "6px",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Streak
                      </div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 800,
                          color: "var(--accent-primary, #f97316)",
                        }}
                      >
                        🔥 {bestStreak}d
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        30d Adherence
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 800 }}>
                        {avgAdherence}%
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        Timeline
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 800 }}>
                        Wk {weeksElapsed}
                      </div>
                    </div>
                  </div>

                  {/* Today's Treatments Quick Doses */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                      }}
                    >
                      Today&apos;s Regimen Check-in:
                    </span>

                    {comp.treatments.length === 0 ? (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        No active treatments configured yet.
                      </span>
                    ) : (
                      comp.treatments.map((treatment) => {
                        const log = recentLogs.find(
                          (l) =>
                            l.treatmentId === treatment.id &&
                            l.logDate === todayIso &&
                            l.userId === (comp.profile.userId || currentUserId)
                        );
                        const completedDoses = log?.completedDoses || 0;

                        return (
                          <div
                            key={treatment.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "12px",
                              padding: "6px 10px",
                              background: "var(--bg-main)",
                              borderRadius: "6px",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              {treatment.name}
                            </span>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              {Array.from({ length: treatment.timesPerDay }).map(
                                (_, idx) => {
                                  const isDone = completedDoses > idx;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      disabled={!comp.canLogDoses}
                                      onClick={() =>
                                        handleToggleDose(
                                          comp.profile.id,
                                          treatment.id,
                                          idx,
                                          treatment.timesPerDay,
                                          comp.canLogDoses,
                                          comp.profile.userId,
                                          comp.profile.creatorUsername
                                        )
                                      }
                                      style={{
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        border: `1px solid ${
                                          isDone
                                            ? "var(--success-color, #22c55e)"
                                            : "var(--border-color)"
                                        }`,
                                        background: isDone
                                          ? "rgba(34, 197, 94, 0.15)"
                                          : "transparent",
                                        color: isDone
                                          ? "var(--success-color, #22c55e)"
                                          : "var(--text-muted)",
                                        cursor: comp.canLogDoses
                                          ? "pointer"
                                          : "not-allowed",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      {isDone && <Check size={11} />}
                                      <span>
                                        {treatment.timesPerDay === 1
                                          ? "Applied"
                                          : idx === 0
                                          ? "AM"
                                          : "PM"}
                                      </span>
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Latest Scalp Photo Preview */}
                  {comp.latestPhoto && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        paddingTop: "6px",
                        borderTop: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "6px",
                          overflow: "hidden",
                          background: "#000",
                          flexShrink: 0,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setComparisonPhoto(comp.latestPhoto || null);
                          setIsComparisonOpen(true);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={comp.latestPhoto.cloudinaryUrl}
                          alt="Latest scalp photo"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "12px" }}>
                        <div style={{ fontWeight: 600 }}>
                          Week {comp.latestPhotoWeek} Scalp Update
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--text-muted)",
                            textTransform: "capitalize",
                          }}
                        >
                          {comp.latestPhoto.angle.replace("_", " ")} • Click to inspect
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: ACTIVE PROFILE DETAIL VIEW */}
      {activeProfile && (
        <>
          {/* Active Profile Header Banner */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "16px 20px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "18px", fontWeight: 700 }}>
                  {activeProfile.name}
                </span>

                {/* Owner Badge */}
                <span
                  style={{
                    padding: "2px 7px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background:
                      activeProfile.creatorUsername === "admin"
                        ? "rgba(249, 115, 22, 0.15)"
                        : "rgba(59, 130, 246, 0.15)",
                    color:
                      activeProfile.creatorUsername === "admin"
                        ? "var(--accent-primary, #f97316)"
                        : "var(--accent-blue, #3b82f6)",
                  }}
                >
                  👑 Owner: @{activeProfile.creatorUsername}
                </span>

                {/* Collaborator Pills */}
                {collaborators.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(168, 85, 247, 0.15)",
                      color: "var(--accent-purple, #a855f7)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>👤 @{c.username}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCollaborator(c.id, c.username)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "inherit",
                          opacity: 0.7,
                          display: "inline-flex",
                          alignItems: "center",
                        }}
                        title={`Remove @${c.username}`}
                        aria-label={`Remove @${c.username}`}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}

                {/* Add Collaborator Button (Owner or Super Admin only) */}
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      borderRadius: "10px",
                    }}
                    onClick={() => setIsAddCollaboratorOpen(true)}
                  >
                    <UserPlus size={11} />
                    <span>+ Add Collaborator</span>
                  </button>
                )}

                {/* Privacy Badge */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "2px 7px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background:
                      activeProfile.visibility === "private"
                        ? "rgba(100, 116, 139, 0.15)"
                        : "rgba(34, 197, 94, 0.15)",
                    color:
                      activeProfile.visibility === "private"
                        ? "var(--text-muted)"
                        : "var(--success-color, #22c55e)",
                  }}
                >
                  {activeProfile.visibility === "private" ? (
                    <>
                      <Lock size={11} /> Private
                    </>
                  ) : (
                    <>
                      <Globe size={11} /> Public
                    </>
                  )}
                </span>

                {/* Role indicator badge */}
                {isOwner ? (
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(249, 115, 22, 0.12)",
                      color: "var(--accent-primary, #f97316)",
                    }}
                  >
                    Profile Owner
                  </span>
                ) : isCollaborator ? (
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(59, 130, 246, 0.12)",
                      color: "var(--accent-blue, #3b82f6)",
                    }}
                  >
                    Collaborator
                  </span>
                ) : !canEdit ? (
                  <span
                    style={{
                      padding: "2px 7px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "rgba(100, 116, 139, 0.15)",
                      color: "var(--text-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    <Eye size={12} /> View Only
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                  display: "flex",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <span>Baseline Start: {activeProfile.baselineDate}</span>
                {activeProfile.notes && <span>• {activeProfile.notes}</span>}
                {collaborators.length > 0 && (
                  <span>
                    • {collaborators.length} collaborator{collaborators.length > 1 ? "s" : ""} on shared regimen
                  </span>
                )}
              </div>
            </div>

            {/* Profile Action Buttons: Strictly restricted to Owner or Super Admin */}
            {canEdit && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onClick={() => setIsEditProfileModalOpen(true)}
                >
                  <Edit2 size={13} />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: "6px 10px",
                    fontSize: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--danger-color, #ef4444)",
                  }}
                  onClick={handleDeleteProfile}
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-color)",
              gap: "20px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("regimen")}
              style={{
                padding: "10px 4px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${
                  activeTab === "regimen"
                    ? "var(--accent-primary, #f97316)"
                    : "transparent"
                }`,
                color:
                  activeTab === "regimen"
                    ? "var(--accent-primary, #f97316)"
                    : "var(--text-secondary)",
                fontWeight: activeTab === "regimen" ? 600 : 500,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Daily Regimen & Streaks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("photos")}
              style={{
                padding: "10px 4px",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${
                  activeTab === "photos"
                    ? "var(--accent-primary, #f97316)"
                    : "transparent"
                }`,
                color:
                  activeTab === "photos"
                    ? "var(--accent-primary, #f97316)"
                    : "var(--text-secondary)",
                fontWeight: activeTab === "photos" ? 600 : 500,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Weekly Photo Sessions ({photoSessions.length})
            </button>
          </div>

          {/* TAB 1: DAILY REGIMEN & STREAKS */}
          {activeTab === "regimen" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {/* 7-Day Date Selector Strip */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    overflowX: "auto",
                    paddingBottom: "4px",
                  }}
                >
                  {past7Days.map((dateStr) => {
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === todayIso;
                    const d = new Date(`${dateStr}T00:00:00`);
                    const weekday = d.toLocaleDateString("en-US", {
                      weekday: "short",
                    });
                    const dayNum = d.getDate();

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: `1px solid ${
                            isSelected
                              ? "var(--accent-primary, #f97316)"
                              : "var(--border-color)"
                          }`,
                          background: isSelected
                            ? "rgba(249, 115, 22, 0.12)"
                            : "var(--bg-card)",
                          color: isSelected
                            ? "var(--accent-primary, #f97316)"
                            : "var(--text-primary)",
                          cursor: "pointer",
                          minWidth: "56px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                          }}
                        >
                          {isToday ? "Today" : weekday}
                        </span>
                        <span style={{ fontSize: "15px", fontWeight: 700 }}>
                          {dayNum}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Only owner or superadmin can add treatments */}
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                    }}
                    onClick={() => {
                      setEditingTreatment(null);
                      setIsTreatmentModalOpen(true);
                    }}
                  >
                    <Plus size={15} />
                    <span>Add Treatment</span>
                  </button>
                )}
              </div>

              {/* Treatments List */}
              {treatments.length === 0 ? (
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px dashed var(--border-color)",
                    borderRadius: "8px",
                    padding: "36px 20px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "14px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No treatments added yet. Add Minoxidil, Derma Roller or any
                    treatment to begin tracking.
                  </p>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingTreatment(null);
                        setIsTreatmentModalOpen(true);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Plus size={15} />
                      <span>Add Minoxidil 5%</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  {treatments.map((treatment) => (
                    <div
                      key={treatment.id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        padding: "16px 20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                      }}
                    >
                      {/* Treatment Header */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                fontSize: "16px",
                                fontWeight: 600,
                              }}
                            >
                              {treatment.name}
                            </h3>
                            <span
                              style={{
                                fontSize: "11px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "var(--bg-main)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border-color)",
                              }}
                            >
                              {treatment.timesPerDay}x / day
                            </span>
                          </div>
                          {treatment.notes && (
                            <p
                              style={{
                                margin: "4px 0 0 0",
                                fontSize: "12px",
                                color: "var(--text-muted)",
                              }}
                            >
                              {treatment.notes}
                            </p>
                          )}
                        </div>

                        {/* Edit/Delete Treatment: Only owner or superadmin */}
                        {canEdit && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() => {
                                setEditingTreatment(treatment);
                                setIsTreatmentModalOpen(true);
                              }}
                              aria-label="Edit treatment"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              style={{ color: "var(--danger-color, #ef4444)" }}
                              onClick={() =>
                                handleDeleteTreatment(
                                  treatment.id,
                                  treatment.name
                                )
                              }
                              aria-label="Delete treatment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Participant Check-ins (Distinct Multi-User Streaks & Doses) */}
                      {participants.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            Participant Doses & Streaks:
                          </span>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                participants.length === 1
                                  ? "1fr"
                                  : "repeat(auto-fit, minmax(280px, 1fr))",
                              gap: "10px",
                            }}
                          >
                            {participants.map((part) => {
                              const partLog = recentLogs.find(
                                (l) =>
                                  l.treatmentId === treatment.id &&
                                  l.logDate === selectedDate &&
                                  l.userId === part.userId
                              );
                              const completedDoses =
                                partLog?.completedDoses || 0;
                              const partStats =
                                part.treatments.find((t) => t.id === treatment.id)
                                  ?.stats || treatment.stats;
                              const isGoalReached =
                                completedDoses >= treatment.timesPerDay;

                              return (
                                <div
                                  key={part.userId}
                                  style={{
                                    background: "var(--bg-main)",
                                    border: `1px solid ${
                                      isGoalReached
                                        ? "rgba(34, 197, 94, 0.3)"
                                        : "var(--border-color)"
                                    }`,
                                    borderRadius: "6px",
                                    padding: "10px 14px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      flexWrap: "wrap",
                                      gap: "6px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          fontSize: "13px",
                                        }}
                                      >
                                        @{part.username}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          padding: "1px 6px",
                                          borderRadius: "4px",
                                          fontWeight: 600,
                                          background: part.isOwner
                                            ? "rgba(249, 115, 22, 0.15)"
                                            : "rgba(59, 130, 246, 0.15)",
                                          color: part.isOwner
                                            ? "var(--accent-primary, #f97316)"
                                            : "var(--accent-blue, #3b82f6)",
                                        }}
                                      >
                                        {part.isOwner ? "👑 Owner" : "👤 Collaborator"}
                                      </span>
                                      {!part.canLog && (
                                        <span
                                          style={{
                                            fontSize: "10px",
                                            color: "var(--text-muted)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "2px",
                                          }}
                                        >
                                          <Eye size={10} /> View Only
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        fontSize: "11px",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      <span>
                                        🔥{" "}
                                        <strong
                                          style={{ color: "var(--text-primary)" }}
                                        >
                                          {partStats.currentStreak}d
                                        </strong>
                                      </span>
                                      <span>
                                        30d:{" "}
                                        <strong
                                          style={{ color: "var(--text-primary)" }}
                                        >
                                          {partStats.adherenceRate30d}%
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Doses Check-in Buttons */}
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "6px",
                                    }}
                                  >
                                    {Array.from({
                                      length: treatment.timesPerDay,
                                    }).map((_, idx) => {
                                      const isDoseDone = completedDoses > idx;
                                      const label =
                                        treatment.timesPerDay === 1
                                          ? "Applied"
                                          : treatment.timesPerDay === 2
                                          ? idx === 0
                                            ? "AM"
                                            : "PM"
                                          : `Dose ${idx + 1}`;

                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          disabled={!part.canLog}
                                          onClick={() =>
                                            handleToggleDose(
                                              activeProfile.id,
                                              treatment.id,
                                              idx,
                                              treatment.timesPerDay,
                                              part.canLog,
                                              part.userId,
                                              part.username
                                            )
                                          }
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            padding: "5px 10px",
                                            borderRadius: "5px",
                                            border: `1px solid ${
                                              isDoseDone
                                                ? "var(--success-color, #22c55e)"
                                                : "var(--border-color)"
                                            }`,
                                            background: isDoseDone
                                              ? "rgba(34, 197, 94, 0.12)"
                                              : "var(--bg-card)",
                                            color: isDoseDone
                                              ? "var(--success-color, #22c55e)"
                                              : "var(--text-primary)",
                                            cursor: part.canLog
                                              ? "pointer"
                                              : "not-allowed",
                                            fontWeight: 600,
                                            fontSize: "12px",
                                            transition: "all 0.1s ease",
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: "13px",
                                              height: "13px",
                                              borderRadius: "3px",
                                              border: `1.5px solid ${
                                                isDoseDone
                                                  ? "var(--success-color, #22c55e)"
                                                  : "var(--text-muted)"
                                              }`,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              background: isDoseDone
                                                ? "var(--success-color, #22c55e)"
                                                : "transparent",
                                            }}
                                          >
                                            {isDoseDone && (
                                              <Check size={10} color="#fff" />
                                            )}
                                          </div>
                                          <span>{label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WEEKLY PHOTO SESSIONS */}
          {activeTab === "photos" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                    Scalp Progress Gallery
                  </h3>
                  <p
                    style={{
                      margin: "2px 0 0 0",
                      fontSize: "12px",
                      color: "var(--text-muted)",
                    }}
                  >
                    Take weekly photos from matching angles to track crown and
                    hairline density.
                  </p>
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {allPhotoSessions.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                      onClick={() => {
                        setComparisonPhoto(null);
                        setIsComparisonOpen(true);
                      }}
                    >
                      <Sparkles size={15} />
                      <span>Compare Journeys</span>
                    </button>
                  )}

                  {/* Any participant (or superadmin) can upload photo session */}
                  {(isOwner || isCollaborator || isSuperAdmin) && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                      onClick={() => setIsPhotoModalOpen(true)}
                    >
                      <Camera size={15} />
                      <span>New Photo Session</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Participant Filter Chips */}
              {participants.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    padding: "8px 12px",
                    background: "var(--bg-card)",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    Filter Participant:
                  </span>
                  <button
                    type="button"
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      borderRadius: "14px",
                      fontWeight: 600,
                      background:
                        selectedPhotoParticipant === "all"
                          ? "rgba(249, 115, 22, 0.15)"
                          : "var(--bg-main)",
                      color:
                        selectedPhotoParticipant === "all"
                          ? "var(--accent-primary, #f97316)"
                          : "var(--text-secondary)",
                      border: `1px solid ${
                        selectedPhotoParticipant === "all"
                          ? "var(--accent-primary, #f97316)"
                          : "var(--border-color)"
                      }`,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedPhotoParticipant("all")}
                  >
                    All Photos ({photoSessions.length})
                  </button>
                  {participants.map((p) => {
                    const count = photoSessions.filter(
                      (s) => s.userId === p.userId
                    ).length;
                    const isSelected = selectedPhotoParticipant === p.userId;
                    return (
                      <button
                        key={p.userId}
                        type="button"
                        style={{
                          padding: "4px 10px",
                          fontSize: "11px",
                          borderRadius: "14px",
                          fontWeight: 600,
                          background: isSelected
                            ? "rgba(249, 115, 22, 0.15)"
                            : "var(--bg-main)",
                          color: isSelected
                            ? "var(--accent-primary, #f97316)"
                            : "var(--text-secondary)",
                          border: `1px solid ${
                            isSelected
                              ? "var(--accent-primary, #f97316)"
                              : "var(--border-color)"
                          }`,
                          cursor: "pointer",
                        }}
                        onClick={() => setSelectedPhotoParticipant(p.userId)}
                      >
                        @{p.username} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {displayedPhotoSessions.length === 0 ? (
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px dashed var(--border-color)",
                    borderRadius: "8px",
                    padding: "40px 20px",
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 12px 0",
                      fontSize: "14px",
                      color: "var(--text-muted)",
                    }}
                  >
                    No scalp photos found for this selection.
                  </p>
                  {(isOwner || isCollaborator || isSuperAdmin) && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setIsPhotoModalOpen(true)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Camera size={16} />
                      <span>Upload Week 1 Photos</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  {displayedPhotoSessions.map((session) => {
                    const sessionOwner = session.username || "participant";
                    const canDeleteSession =
                      isSuperAdmin || session.userId === currentUserId;

                    return (
                      <div
                        key={session.id}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          padding: "16px 20px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "rgba(249, 115, 22, 0.15)",
                                color: "var(--accent-primary, #f97316)",
                                fontWeight: 700,
                                fontSize: "12px",
                              }}
                            >
                              Week {session.weekNumber}
                            </span>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "10px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "rgba(59, 130, 246, 0.15)",
                                color: "var(--accent-blue, #3b82f6)",
                              }}
                            >
                              @{sessionOwner}
                            </span>
                            <span style={{ fontSize: "14px", fontWeight: 600 }}>
                              {session.sessionDate}
                            </span>
                            {session.notes && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-muted)",
                                }}
                              >
                                • {session.notes}
                              </span>
                            )}
                          </div>

                          {canDeleteSession && (
                            <button
                              type="button"
                              className="icon-button"
                              style={{ color: "var(--danger-color, #ef4444)" }}
                              onClick={() =>
                                handleDeletePhotoSession(
                                  session.id,
                                  session.weekNumber
                                )
                              }
                              aria-label="Delete photo session"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Photos Grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(140px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          {session.photos.map((photo) => (
                            <div
                              key={photo.id}
                              onClick={() => {
                                setComparisonPhoto(photo);
                                setIsComparisonOpen(true);
                              }}
                              style={{
                                position: "relative",
                                height: "130px",
                                borderRadius: "6px",
                                overflow: "hidden",
                                border: "1px solid var(--border-color)",
                                background: "#000",
                                cursor: "pointer",
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.cloudinaryUrl}
                                alt={`Week ${session.weekNumber} - ${photo.angle}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  transition: "transform 0.2s ease",
                                }}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  padding: "4px 6px",
                                  background:
                                    "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
                                  fontSize: "11px",
                                  color: "#fff",
                                  textTransform: "capitalize",
                                  fontWeight: 600,
                                }}
                              >
                                {photo.angle.replace("_", " ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onSaved={(newId) => handleProfileChange(newId)}
      />

      {activeProfile && (
        <ProfileModal
          profile={activeProfile}
          isOpen={isEditProfileModalOpen}
          onClose={() => setIsEditProfileModalOpen(false)}
          onSaved={() => refreshDataInBackground()}
        />
      )}

      {activeProfile && (
        <TreatmentModal
          profileId={activeProfile.id}
          treatment={editingTreatment}
          isOpen={isTreatmentModalOpen}
          onClose={() => setIsTreatmentModalOpen(false)}
          onSaved={() => refreshDataInBackground()}
        />
      )}

      {activeProfile && (
        <AddCollaboratorModal
          profileId={activeProfile.id}
          profileName={activeProfile.name}
          isOpen={isAddCollaboratorOpen}
          onClose={() => setIsAddCollaboratorOpen(false)}
          existingUserIds={collaborators.map((c) => c.userId)}
          ownerUserId={activeProfile.userId}
          onAdded={() => refreshDataInBackground()}
        />
      )}

      {activeProfile && (
        <PhotoSessionModal
          profileId={activeProfile.id}
          baselineDate={activeProfile.baselineDate}
          participants={participants}
          currentUserId={currentUserId}
          isSuperAdmin={isSuperAdmin}
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          onSaved={() => refreshDataInBackground()}
        />
      )}

      {isComparisonOpen && allPhotoSessions.length > 0 && (
        <PhotoComparisonModal
          sessions={allPhotoSessions}
          initialPhoto={comparisonPhoto}
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
        />
      )}
    </div>
  );
}
