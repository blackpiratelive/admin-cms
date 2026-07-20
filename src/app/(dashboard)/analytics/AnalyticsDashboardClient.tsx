"use client";

import { useState, useTransition } from "react";
import {
  GlobalOverviewStats,
  MemoryScoreBreakdown,
  TimelineCacheItem,
  TimeFilterRange,
  SupportedModule,
  AnalyticsSnapshotDTO,
} from "@/features/analytics/types";
import {
  rebuildAnalyticsEngineAction,
  togglePinMemoryAction,
  getModuleAnalyticsAction,
} from "@/features/analytics/actions";
import {
  BarChart3,
  TrendingUp,
  Brain,
  Pin,
  Clock,
  Database,
  Flame,
  HardDrive,
  RefreshCw,
  Sparkles,
  BookOpen,
  MessageSquareText,
  CheckSquare,
  Image as ImageIcon,
  Film,
  Tv,
  Music,
  Users,
  MapPin,
  Compass,
  Calendar,
  Layers,
  Filter,
} from "lucide-react";

interface AnalyticsDashboardClientProps {
  initialOverview: GlobalOverviewStats;
  initialMemoryScores: MemoryScoreBreakdown[];
  initialTimeline: TimelineCacheItem[];
  initialSnapshots: AnalyticsSnapshotDTO[];
}

export function AnalyticsDashboardClient({
  initialOverview,
  initialMemoryScores,
  initialTimeline,
  initialSnapshots,
}: AnalyticsDashboardClientProps) {
  const [isPending, startTransition] = useTransition();
  const [timeFilter, setTimeFilter] = useState<TimeFilterRange>("lifetime");
  const [activeTab, setActiveTab] = useState<"overview" | "modules" | "memory_hub" | "timeline" | "snapshots">("overview");
  const [selectedModule, setSelectedModule] = useState<SupportedModule>("journal");
  const [moduleData, setModuleData] = useState<any>(null);
  const [loadingModule, setLoadingModule] = useState(false);
  const [memoryScores, setMemoryScores] = useState<MemoryScoreBreakdown[]>(initialMemoryScores);
  const [overview, setOverview] = useState<GlobalOverviewStats>(initialOverview);

  const handleRebuildCache = () => {
    startTransition(async () => {
      const updated = await rebuildAnalyticsEngineAction();
      setOverview(updated);
    });
  };

  const handleTogglePin = async (entityType: string, entityId: string) => {
    const res = await togglePinMemoryAction(entityType, entityId);
    if (res.success) {
      setMemoryScores((prev) =>
        prev.map((m) => {
          if (m.entityType === entityType && m.entityId === entityId) {
            return {
              ...m,
              isPinned: res.isPinned,
              pinnedBonus: res.isPinned ? 100 : 0,
              finalScore: Math.min(100, Number((m.finalScore + (res.isPinned ? 7 : -7)).toFixed(2))),
            };
          }
          return m;
        })
      );
    }
  };

  const handleSelectModule = async (mod: SupportedModule) => {
    setSelectedModule(mod);
    setLoadingModule(true);
    try {
      const data = await getModuleAnalyticsAction(mod, timeFilter);
      setModuleData(data);
    } catch (err) {
      console.error("Error loading module analytics:", err);
    } finally {
      setLoadingModule(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Brain size={28} style={{ color: "var(--accent-color, #ff6600)" }} />
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Analytics & Memory Engine</h1>
          </div>
          <p style={{ margin: "0.25rem 0 0 0", opacity: 0.7, fontSize: "0.875rem" }}>
            Event-driven intelligence, continuous caching, and memory discovery across all 10 modules
          </p>
        </div>

        <button
          onClick={handleRebuildCache}
          disabled={isPending}
          className="btn btn-primary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={16} className={isPending ? "spin" : ""} />
          <span>{isPending ? "Rebuilding Caches..." : "Rebuild Analytics Engine"}</span>
        </button>
      </div>

      {/* Time Filter Bar */}
      <div
        style={{
          background: "var(--card-bg, rgba(255,255,255,0.04))",
          padding: "0.75rem 1rem",
          borderRadius: "12px",
          border: "1px solid var(--border-color, rgba(255,255,255,0.08))",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", opacity: 0.8, fontSize: "0.85rem", fontWeight: 600 }}>
          <Filter size={15} />
          <span>Time Horizon:</span>
        </div>
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["this_week", "This Week"],
            ["last_week", "Last Week"],
            ["this_month", "This Month"],
            ["last_month", "Last Month"],
            ["this_year", "This Year"],
            ["last_year", "Last Year"],
            ["lifetime", "Lifetime"],
          ] as Array<[TimeFilterRange, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTimeFilter(key)}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              fontWeight: timeFilter === key ? 700 : 500,
              background: timeFilter === key ? "var(--accent-color, #ff6600)" : "transparent",
              color: timeFilter === key ? "#fff" : "inherit",
              border: "1px solid " + (timeFilter === key ? "transparent" : "var(--border-color, rgba(255,255,255,0.1))"),
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ borderBottom: "1px solid var(--border-color, rgba(255,255,255,0.1))", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {[
            { id: "overview", label: "Global Overview", icon: BarChart3 },
            { id: "modules", label: "Module Deep Dives", icon: Layers },
            { id: "memory_hub", label: "Memory Index Hub", icon: Sparkles },
            { id: "timeline", label: "Unified Timeline Stream", icon: Clock },
            { id: "snapshots", label: "Historical Snapshots", icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === "modules" && !moduleData) handleSelectModule(selectedModule);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 0.25rem",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid var(--accent-color, #ff6600)" : "2px solid transparent",
                  color: active ? "var(--accent-color, #ff6600)" : "inherit",
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Global Overview */}
      {activeTab === "overview" && (
        <div>
          {/* Key Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            {[
              { title: "Journal Entries", value: overview.totalJournalEntries, icon: BookOpen, color: "#3b82f6" },
              { title: "Microblogs", value: overview.totalMicroblogs, icon: MessageSquareText, color: "#10b981" },
              { title: "Todos Completed", value: overview.totalTodos, icon: CheckSquare, color: "#f59e0b" },
              { title: "Gallery Photos", value: overview.totalPhotos, icon: ImageIcon, color: "#ec4899" },
              { title: "Movies Watched", value: overview.totalMovies, icon: Film, color: "#8b5cf6" },
              { title: "TV Shows", value: overview.totalTvShows, icon: Tv, color: "#06b6d4" },
              { title: "Music Tracks", value: overview.totalMusicItems, icon: Music, color: "#14b8a6" },
              { title: "People Hub", value: overview.totalPeople, icon: Users, color: "#eab308" },
              { title: "Locations", value: overview.totalLocations, icon: MapPin, color: "#ef4444" },
              { title: "Trips Planned", value: overview.totalTrips, icon: Compass, color: "#6366f1" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  style={{
                    background: "var(--card-bg, rgba(255,255,255,0.03))",
                    padding: "1rem",
                    borderRadius: "10px",
                    border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontSize: "0.8rem", opacity: 0.7, fontWeight: 600 }}>{stat.title}</span>
                    <Icon size={16} style={{ color: stat.color }} />
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stat.value.toLocaleString()}</div>
                </div>
              );
            })}
          </div>

          {/* System Performance & Streak Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
            <div
              style={{
                background: "var(--card-bg, rgba(255,255,255,0.03))",
                padding: "1.25rem",
                borderRadius: "12px",
                border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <Flame size={20} style={{ color: "#f97316" }} />
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Journal Writing Streak</h3>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: 800, color: "#f97316" }}>{overview.journalStreak}</span>
                <span style={{ opacity: 0.7 }}>days current streak</span>
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
                Longest recorded streak: <strong>{overview.longestJournalStreak} days</strong>
              </div>
            </div>

            <div
              style={{
                background: "var(--card-bg, rgba(255,255,255,0.03))",
                padding: "1.25rem",
                borderRadius: "12px",
                border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <HardDrive size={20} style={{ color: "#3b82f6" }} />
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Storage & Database Engine</h3>
              </div>
              <div style={{ fontSize: "0.9rem", display: "grid", gap: "0.5rem" }}>
                <div>Media Storage: <strong>{(overview.storageUsedBytes / (1024 * 1024)).toFixed(2)} MB</strong></div>
                <div>SQLite Database Size: <strong>{(overview.databaseSizeBytes / 1024).toFixed(0)} KB</strong></div>
                <div>Sync Engine Status: <span style={{ color: "#10b981", fontWeight: 600 }}>{overview.syncStatus}</span></div>
                <div style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.25rem" }}>
                  Last Cache Update: {new Date(overview.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Module Deep Dives */}
      {activeTab === "modules" && (
        <div>
          {/* Module Selector Pills */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {(
              [
                ["journal", "Journal", BookOpen],
                ["microblog", "Microblog", MessageSquareText],
                ["todos", "Todos", CheckSquare],
                ["gallery", "Gallery", ImageIcon],
                ["movies", "Movies", Film],
                ["tv", "TV Shows", Tv],
                ["music", "Music", Music],
                ["people", "People", Users],
                ["locations", "Locations", MapPin],
                ["trips", "Trips", Compass],
              ] as Array<[SupportedModule, string, any]>
            ).map(([mKey, label, Icon]) => (
              <button
                key={mKey}
                onClick={() => handleSelectModule(mKey)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.85rem",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  fontWeight: selectedModule === mKey ? 700 : 500,
                  background: selectedModule === mKey ? "var(--accent-color, #ff6600)" : "var(--card-bg, rgba(255,255,255,0.03))",
                  color: selectedModule === mKey ? "#fff" : "inherit",
                  border: "1px solid " + (selectedModule === mKey ? "transparent" : "var(--border-color, rgba(255,255,255,0.08))"),
                  cursor: "pointer",
                }}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {loadingModule ? (
            <div style={{ padding: "3rem", textAlign: "center", opacity: 0.7 }}>Loading analytics data for {selectedModule}...</div>
          ) : (
            <div
              style={{
                background: "var(--card-bg, rgba(255,255,255,0.03))",
                padding: "1.5rem",
                borderRadius: "12px",
                border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
              }}
            >
              <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>{selectedModule} Detailed Analytics</h2>
              <pre
                style={{
                  background: "rgba(0,0,0,0.3)",
                  padding: "1rem",
                  borderRadius: "8px",
                  maxHeight: "450px",
                  overflow: "auto",
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                }}
              >
                {JSON.stringify(moduleData || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Memory Index Hub */}
      {activeTab === "memory_hub" && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Memory Discovery Hub & Scoring Engine</h2>
            <p style={{ margin: "0.25rem 0 1rem 0", opacity: 0.7, fontSize: "0.85rem" }}>
              Memories ranked across Richness, Diversity, Longevity, Recurrence, Recency, Favorite & Pinned bonuses
            </p>
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {memoryScores.map((mem) => (
              <div
                key={`${mem.entityType}_${mem.entityId}`}
                style={{
                  background: "var(--card-bg, rgba(255,255,255,0.03))",
                  padding: "1rem 1.25rem",
                  borderRadius: "10px",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div style={{ flex: 1, minWidth: "240px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: "rgba(255,102,0,0.15)",
                        color: "var(--accent-color, #ff6600)",
                      }}
                    >
                      {mem.entityType}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{mem.title}</h3>
                  </div>

                  {/* Sub score pills */}
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem", opacity: 0.8 }}>
                    <span>Richness: <strong>{mem.richnessScore}</strong></span>
                    <span>Diversity: <strong>{mem.diversityScore}</strong></span>
                    <span>Longevity: <strong>{mem.longevityScore}</strong></span>
                    <span>Recurrence: <strong>{mem.recurrenceScore}</strong></span>
                    <span>Recency: <strong>{mem.recencyScore}</strong></span>
                  </div>
                </div>

                {/* Final Memory Score Gauge & Pin Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-color, #ff6600)" }}>
                      {mem.finalScore} <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>/ 100</span>
                    </div>
                    <div style={{ fontSize: "0.7rem", opacity: 0.6 }}>Memory Index Score</div>
                  </div>

                  <button
                    onClick={() => handleTogglePin(mem.entityType, mem.entityId)}
                    title={mem.isPinned ? "Unpin Memory" : "Pin Memory"}
                    style={{
                      background: mem.isPinned ? "var(--accent-color, #ff6600)" : "transparent",
                      color: mem.isPinned ? "#fff" : "inherit",
                      border: "1px solid " + (mem.isPinned ? "transparent" : "var(--border-color, rgba(255,255,255,0.15))"),
                      padding: "0.5rem",
                      borderRadius: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <Pin size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Unified Timeline Stream */}
      {activeTab === "timeline" && (
        <div>
          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem" }}>Unified Activity Timeline Stream</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {initialTimeline.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "var(--card-bg, rgba(255,255,255,0.03))",
                  padding: "0.85rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>{new Date(item.date).toLocaleString()}</div>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  Score: {item.importanceScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Historical Snapshots */}
      {activeTab === "snapshots" && (
        <div>
          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.25rem" }}>Historical Snapshots</h2>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {initialSnapshots.map((snap) => (
              <div
                key={snap.id}
                style={{
                  background: "var(--card-bg, rgba(255,255,255,0.03))",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <strong>{snap.periodKey} ({snap.snapshotType})</strong>
                  <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{new Date(snap.createdAt).toLocaleString()}</span>
                </div>
                <pre style={{ margin: 0, fontSize: "0.8rem", maxHeight: "150px", overflow: "auto" }}>
                  {JSON.stringify(snap.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
