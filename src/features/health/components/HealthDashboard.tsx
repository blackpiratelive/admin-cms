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
} from "lucide-react";
import {
  setDoseCompletionAction,
  deleteHealthProfileAction,
  deleteTreatmentAction,
  deletePhotoSessionAction,
  getHealthHubDataAction,
} from "../actions";
import { formatDateIso, shiftDateIso } from "../analytics";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";
import { notify } from "@/lib/notifications";
import { ProfileModal } from "./ProfileModal";
import { TreatmentModal } from "./TreatmentModal";
import { PhotoSessionModal } from "./PhotoSessionModal";
import { PhotoComparisonModal } from "./PhotoComparisonModal";
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

  // Debounce ref for dose updates
  const pendingDoseUpdates = useRef<
    Map<string, { timeoutId: NodeJS.Timeout; completedDoses: number }>
  >(new Map());

  const {
    profiles,
    companionProfiles,
    activeProfile,
    canEdit,
    treatments,
    recentLogs,
    photoSessions,
    allPhotoSessions,
    weeksElapsed,
    currentUsername,
    isSuperAdmin,
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

  // Instant 0ms dose toggle with background write
  const handleToggleDose = (
    profileId: string,
    treatmentId: string,
    doseIndex: number,
    timesPerDay: number,
    canLog: boolean
  ) => {
    if (!canLog) return;

    const currentLog = recentLogs.find(
      (l) => l.treatmentId === treatmentId && l.logDate === selectedDate
    );
    const currentCompleted = currentLog?.completedDoses || 0;

    // Toggle: if clicked dose is already checked, revert to that index; if unchecked, set to doseIndex + 1
    const newCompletedDoses =
      currentCompleted > doseIndex ? doseIndex : doseIndex + 1;

    // 1. Optimistic UI update immediately (0ms perceived latency)
    setData((prev) => {
      const updatedLogs = [...prev.recentLogs];
      const existingIdx = updatedLogs.findIndex(
        (l) => l.treatmentId === treatmentId && l.logDate === selectedDate
      );

      if (existingIdx >= 0) {
        updatedLogs[existingIdx] = {
          ...updatedLogs[existingIdx],
          completedDoses: newCompletedDoses,
        };
      } else {
        updatedLogs.unshift({
          id: `temp_${Date.now()}`,
          profileId,
          treatmentId,
          logDate: selectedDate,
          completedDoses: newCompletedDoses,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const updatedTreatments = prev.treatments.map((t) => {
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
        treatments: updatedTreatments,
        companionProfiles: updatedCompanion,
      };

      setBrowserCache(cacheKey, nextData);
      return nextData;
    });

    // 2. Debounce and execute DB write in background
    const updateKey = `${treatmentId}_${selectedDate}`;
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
            logDate: selectedDate,
            completedDoses: newCompletedDoses,
          }),
        errorMessage: "Failed to sync dose update to server.",
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
              Logged in as <strong>@{currentUsername}</strong> {isSuperAdmin ? "(Super Admin)" : ""} • Shared peer tracker & progress logs
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
                            l.logDate === todayIso
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
                                          comp.canLogDoses
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
                  Created by @{activeProfile.creatorUsername}
                </span>
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
                {!canEdit && (
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
                )}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                  display: "flex",
                  gap: "14px",
                }}
              >
                <span>Baseline Start: {activeProfile.baselineDate}</span>
                {activeProfile.notes && <span>• {activeProfile.notes}</span>}
              </div>
            </div>

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
                  {treatments.map((treatment) => {
                    const log = recentLogs.find(
                      (l) =>
                        l.treatmentId === treatment.id &&
                        l.logDate === selectedDate
                    );
                    const completedDoses = log?.completedDoses || 0;
                    const isGoalReached =
                      completedDoses >= treatment.timesPerDay;

                    return (
                      <div
                        key={treatment.id}
                        style={{
                          background: "var(--bg-card)",
                          border: `1px solid ${
                            isGoalReached
                              ? "rgba(34, 197, 94, 0.4)"
                              : "var(--border-color)"
                          }`,
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
                              {isGoalReached && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: "var(--success-color, #22c55e)",
                                  }}
                                >
                                  <CheckCircle2 size={13} /> Complete
                                </span>
                              )}
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

                        {/* Minimal Dose Checkbox Buttons (0ms Instant Input) */}
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "10px",
                          }}
                        >
                          {Array.from({ length: treatment.timesPerDay }).map(
                            (_, idx) => {
                              const isDoseDone = completedDoses > idx;
                              const label =
                                treatment.timesPerDay === 1
                                  ? "Applied Today"
                                  : treatment.timesPerDay === 2
                                  ? idx === 0
                                    ? "Dose 1 (AM)"
                                    : "Dose 2 (PM)"
                                  : `Dose ${idx + 1}`;

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() =>
                                    handleToggleDose(
                                      activeProfile.id,
                                      treatment.id,
                                      idx,
                                      treatment.timesPerDay,
                                      canEdit
                                    )
                                  }
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "8px 14px",
                                    borderRadius: "6px",
                                    border: `1px solid ${
                                      isDoseDone
                                        ? "var(--success-color, #22c55e)"
                                        : "var(--border-color)"
                                    }`,
                                    background: isDoseDone
                                      ? "rgba(34, 197, 94, 0.12)"
                                      : "var(--bg-main)",
                                    color: isDoseDone
                                      ? "var(--success-color, #22c55e)"
                                      : "var(--text-primary)",
                                    cursor: canEdit ? "pointer" : "default",
                                    fontWeight: 600,
                                    fontSize: "13px",
                                    transition: "all 0.1s ease",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "16px",
                                      height: "16px",
                                      borderRadius: "4px",
                                      border: `2px solid ${
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
                                      color: "#fff",
                                    }}
                                  >
                                    {isDoseDone && (
                                      <CheckCircle2 size={12} color="#fff" />
                                    )}
                                  </div>
                                  <span>{label}</span>
                                </button>
                              );
                            }
                          )}
                        </div>

                        {/* Minimal Streak & Adherence Metrics Strip */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            paddingTop: "10px",
                            borderTop: "1px solid var(--border-color)",
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Flame
                              size={14}
                              color="var(--accent-primary, #f97316)"
                            />
                            <strong style={{ color: "var(--text-primary)" }}>
                              {treatment.stats.currentStreak}
                            </strong>{" "}
                            day streak
                          </span>
                          <span>•</span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Award
                              size={14}
                              color="var(--accent-primary, #f97316)"
                            />
                            Best:{" "}
                            <strong style={{ color: "var(--text-primary)" }}>
                              {treatment.stats.longestStreak}
                            </strong>{" "}
                            days
                          </span>
                          <span>•</span>
                          <span>
                            30-day adherence:{" "}
                            <strong style={{ color: "var(--text-primary)" }}>
                              {treatment.stats.adherenceRate30d}%
                            </strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
                      onClick={() => setIsPhotoModalOpen(true)}
                    >
                      <Camera size={15} />
                      <span>New Photo Session</span>
                    </button>
                  )}
                </div>
              </div>

              {photoSessions.length === 0 ? (
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
                    No scalp photos uploaded for this profile yet.
                  </p>
                  {canEdit && (
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
                  {photoSessions.map((session) => (
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

                        {canEdit && (
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
                  ))}
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
        <PhotoSessionModal
          profileId={activeProfile.id}
          baselineDate={activeProfile.baselineDate}
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
