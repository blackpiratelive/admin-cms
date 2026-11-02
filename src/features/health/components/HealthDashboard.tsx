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
    activeProfile,
    canEdit,
    treatments,
    recentLogs,
    photoSessions,
    weeksElapsed,
  } = data;

  // Background refresh data without full-page reloads
  const refreshDataInBackground = async () => {
    try {
      const fresh = await getHealthHubDataAction(activeProfile?.id);
      setData(fresh);
      setBrowserCache(`health_cache_${fresh.activeProfile?.id || "default"}`, fresh);
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
    treatmentId: string,
    doseIndex: number,
    timesPerDay: number
  ) => {
    if (!activeProfile || !canEdit) return;

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
          profileId: activeProfile.id,
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

      const nextData: HealthHubData = {
        ...prev,
        recentLogs: updatedLogs,
        treatments: updatedTreatments,
      };

      // Update browser cache immediately
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
            profileId: activeProfile.id,
            treatmentId,
            logDate: selectedDate,
            completedDoses: newCompletedDoses,
          }),
        errorMessage: "Failed to sync dose update to server.",
        onError: () => {
          // Revert optimistic state on network failure
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

    // Optimistically update
    setData((prev) => ({
      ...prev,
      profiles: remainingProfiles,
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
    if (!confirm(`Delete treatment "${name}"? Historical logs will also be removed.`)) {
      return;
    }

    // Optimistically remove from state in 0ms
    setData((prev) => {
      const nextData: HealthHubData = {
        ...prev,
        treatments: prev.treatments.filter((t) => t.id !== treatmentId),
        recentLogs: prev.recentLogs.filter((l) => l.treatmentId !== treatmentId),
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

    // Optimistically remove from state in 0ms
    setData((prev) => {
      const nextData: HealthHubData = {
        ...prev,
        photoSessions: prev.photoSessions.filter((s) => s.id !== sessionId),
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
  const past7Days = Array.from({ length: 7 }, (_, i) => shiftDateIso(todayIso, -i));

  // Highest streak
  const bestStreak = treatments.reduce(
    (max, t) => Math.max(max, t.stats.currentStreak),
    0
  );
  // Average 30d adherence
  const avgAdherence =
    treatments.length > 0
      ? Math.round(
          treatments.reduce((acc, t) => acc + t.stats.adherenceRate30d, 0) /
            treatments.length
        )
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header & Profile Switcher */}
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
                Health & Hair Regrowth
              </h1>
            </div>
            <p
              style={{
                margin: "2px 0 0 0",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              Weekly scalp photo logs, treatment regimens & streak tracking
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Profile Selector */}
          {profiles.length > 0 && (
            <select
              className="form-input"
              style={{
                width: "auto",
                minWidth: "180px",
                padding: "7px 12px",
                fontSize: "13px",
                fontWeight: 600,
              }}
              value={activeProfile?.id || ""}
              onChange={(e) => handleProfileChange(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isOwner ? "(You)" : "(Public)"}{" "}
                  {p.visibility === "private" ? "🔒" : "🌐"}
                </option>
              ))}
            </select>
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

      {/* Empty State if No Profile */}
      {!activeProfile ? (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            padding: "48px 24px",
            textAlign: "center",
            maxWidth: "600px",
            margin: "40px auto",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(249, 115, 22, 0.12)",
              color: "var(--accent-primary, #f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <HeartPulse size={28} />
          </div>
          <h2 style={{ fontSize: "18px", margin: "0 0 8px 0" }}>
            Welcome to the Health Tracker
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-muted)",
              lineHeight: 1.6,
              margin: "0 0 20px 0",
            }}
          >
            Create your first health profile to track daily Minoxidil doses,
            monitor adherence streaks, and log weekly scalp progress photos.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsProfileModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} />
            <span>Create Profile</span>
          </button>
        </div>
      ) : (
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px", fontWeight: 700 }}>
                  {activeProfile.name}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "12px",
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
                      <Lock size={12} /> Private
                    </>
                  ) : (
                    <>
                      <Globe size={12} /> Public
                    </>
                  )}
                </span>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "rgba(249, 115, 22, 0.15)",
                    color: "var(--accent-primary, #f97316)",
                  }}
                >
                  Week {weeksElapsed}
                </span>
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
                <span>Started: {activeProfile.baselineDate}</span>
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
                  <span>Edit</span>
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

          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--accent-primary, #f97316)",
                  marginBottom: "6px",
                }}
              >
                <Flame size={18} />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Active Streak
                </span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                {bestStreak}{" "}
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--text-muted)",
                  }}
                >
                  days
                </span>
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--accent-primary, #f97316)",
                  marginBottom: "6px",
                }}
              >
                <Award size={18} />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  30-Day Adherence
                </span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                {avgAdherence}%
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--accent-primary, #f97316)",
                  marginBottom: "6px",
                }}
              >
                <Calendar size={18} />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Timeline
                </span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                Week {weeksElapsed}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--accent-primary, #f97316)",
                  marginBottom: "6px",
                }}
              >
                <Camera size={18} />
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                  }}
                >
                  Photo Sessions
                </span>
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800 }}>
                {photoSessions.length}
              </div>
            </div>
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
                    No treatments added yet. Add Minoxidil or any hair treatment
                    to begin tracking your doses.
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
                                      treatment.id,
                                      idx,
                                      treatment.timesPerDay
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
                  {photoSessions.length > 0 && (
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
                      <span>Compare Weeks</span>
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
                    No scalp photos uploaded yet. Take Week 1 photos to
                    establish your baseline!
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

      {isComparisonOpen && photoSessions.length > 0 && (
        <PhotoComparisonModal
          sessions={photoSessions}
          initialPhoto={comparisonPhoto}
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
        />
      )}
    </div>
  );
}
