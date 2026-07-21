"use client";

import { useEffect, useState } from "react";
import { ReadingAnalyticsData } from "@/features/analytics/types";
import { getModuleAnalyticsAction } from "@/features/analytics/actions";
import { getReadingArticlesAction, getReadingMetadataAction, ReadingArticleDTO } from "../actions";
import { ProviderCard } from "@/features/sync/components/ProviderCard";
import { getProvidersOverviewAction, ProviderOverviewDTO } from "@/features/sync/actions";
import {
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Flame,
  Search,
  Star,
  Tag,
  RefreshCw,
  Rss,
  TrendingUp,
} from "lucide-react";

export function ReadingDashboard() {
  const [analytics, setAnalytics] = useState<ReadingAnalyticsData | null>(null);
  const [freshrssProvider, setFreshrssProvider] = useState<ProviderOverviewDTO | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "starred" | "sync">("overview");

  // History state
  const [articles, setArticles] = useState<ReadingArticleDTO[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "read" | "starred" | "unread">("read");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const loadData = async () => {
    try {
      const stats = await getModuleAnalyticsAction("reading");
      if (stats) {
        setAnalytics(stats);
      }

      const providersList = await getProvidersOverviewAction();
      const freshrss = providersList.find((p) => p.slug === "freshrss") || null;
      setFreshrssProvider(freshrss);

      const meta = await getReadingMetadataAction();
      setCategories(meta.categories);
    } catch (err) {
      console.error("Error loading reading data:", err);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getReadingArticlesAction({
        filter: activeTab === "starred" ? "starred" : historyFilter,
        category: selectedCategory || undefined,
        query: searchQuery || undefined,
        page,
        limit: 25,
      });
      setArticles(res.items);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error("Error loading reading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [activeTab, historyFilter, selectedCategory, searchQuery, page]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Rss size={20} style={{ color: "var(--accent)" }} />
            <span>Reading History & Discovery</span>
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Personal reading analytics, starred knowledge graph, and FreshRSS activity stream.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn btn-sm"
            onClick={() => {
              loadData();
              loadHistory();
            }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      {analytics && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "12px 16px",
              borderRadius: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Total Read</span>
              <BookOpen size={16} style={{ color: "#3b82f6" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text-primary)" }}>{analytics.totalRead}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Lifetime articles</div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "12px 16px",
              borderRadius: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Read Today</span>
              <Calendar size={16} style={{ color: "#10b981" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text-primary)" }}>{analytics.readToday}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{analytics.readThisWeek} this week</div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "12px 16px",
              borderRadius: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Reading Streak</span>
              <Flame size={16} style={{ color: "#f59e0b" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text-primary)" }}>{analytics.streakDays} days</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Longest: {analytics.longestStreakDays} days</div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "12px 16px",
              borderRadius: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Reading Time</span>
              <Clock size={16} style={{ color: "#8b5cf6" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {Math.round(analytics.totalEstimatedReadingTimeSeconds / 60)}m
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Avg ~{analytics.averageReadingTimeSeconds}s/article</div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              padding: "12px 16px",
              borderRadius: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
              <span>Starred</span>
              <Star size={16} style={{ fill: "#f59e0b", color: "#f59e0b" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text-primary)" }}>{analytics.totalStarred}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Saved to graph</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-color)", marginBottom: "16px", paddingBottom: "8px" }}>
        <button
          onClick={() => setActiveTab("overview")}
          className={`btn btn-sm ${activeTab === "overview" ? "btn-primary" : ""}`}
        >
          <span>Overview & Sessions</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`btn btn-sm ${activeTab === "history" ? "btn-primary" : ""}`}
        >
          <span>Reading Stream</span>
        </button>
        <button
          onClick={() => setActiveTab("starred")}
          className={`btn btn-sm ${activeTab === "starred" ? "btn-primary" : ""}`}
        >
          <span>Starred Articles ({analytics?.totalStarred || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab("sync")}
          className={`btn btn-sm ${activeTab === "sync" ? "btn-primary" : ""}`}
        >
          <span>FreshRSS Provider</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && analytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
          {/* Recent Reading Sessions Card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              padding: "16px",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <Clock size={16} style={{ color: "var(--accent)" }} />
              <span>Recent Reading Sessions</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
              Activity automatically grouped into dedicated reading sessions (30m threshold).
            </p>

            {analytics.readingSessions.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>
                No reading sessions recorded yet. Sync FreshRSS to import activity.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {analytics.readingSessions.slice(0, 5).map((session, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      background: "var(--bg-sidebar)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "2px",
                      fontSize: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                        {new Date(session.startDate).toLocaleDateString()} at{" "}
                        {new Date(session.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                        {session.articlesCount} articles read • ~{session.wordCount} words
                      </div>
                    </div>
                    <span className="status-badge status-draft" style={{ fontFamily: "var(--font-mono)" }}>
                      {session.durationMinutes}m
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Reading Categories */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              padding: "16px",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
              <Tag size={16} style={{ color: "#10b981" }} />
              <span>Top Reading Categories</span>
            </h3>
            {analytics.topCategories.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
                No categories synced yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {analytics.topCategories.slice(0, 6).map((c, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ color: "var(--text-primary)" }}>{c.category}</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>{c.count} articles</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Favorite Sources */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              padding: "16px",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
              <Rss size={16} style={{ color: "#f97316" }} />
              <span>Favorite Sources</span>
            </h3>
            {analytics.favoriteSources.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
                No feed sources synced yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {analytics.favoriteSources.slice(0, 6).map((s, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                    <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                      {s.name}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>{s.count} reads</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reading Habits */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              padding: "16px",
            }}
          >
            <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
              <TrendingUp size={16} style={{ color: "#8b5cf6" }} />
              <span>Reading Habits</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Most Active Day:</span>
                <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>{analytics.mostActiveWeekday}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Peak Reading Hour:</span>
                <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>{analytics.mostActiveReadingHour}:00</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Avg Reads / Day:</span>
                <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>{analytics.averageArticlesPerDay}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                <span style={{ color: "var(--text-muted)" }}>Top Feed:</span>
                <span style={{ fontWeight: "600", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                  {analytics.mostReadFeed?.name || "None"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Top Category:</span>
                <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                  {analytics.mostReadCategory?.category || "None"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2 & 3: Reading Stream & Starred */}
      {(activeTab === "history" || activeTab === "starred") && (
        <div>
          {/* Filter Bar */}
          <div className="filter-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "200px" }}>
              <Search size={16} style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search articles by title, feed, or category..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="search-input"
              />
            </div>

            {activeTab === "history" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Filter:</label>
                <select
                  value={historyFilter}
                  onChange={(e: any) => {
                    setHistoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="select-input"
                >
                  <option value="read">Read Only</option>
                  <option value="starred">Starred Only</option>
                  <option value="all">All Articles</option>
                </select>
              </div>
            )}

            {categories.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="select-input"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="table-container">
            {loadingHistory ? (
              <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
                Loading reading stream...
              </div>
            ) : articles.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" }}>
                No reading history found matching your filters.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Article / Title</th>
                    <th>Feed Source</th>
                    <th>Category</th>
                    <th className="hide-on-mobile">Read Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((art) => (
                    <tr key={art.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <BookOpen size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
                          <a
                            href={art.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "var(--text-primary)",
                              fontWeight: "500",
                              textDecoration: "none",
                            }}
                          >
                            {art.title}
                          </a>
                          {art.isStarred && <Star size={13} style={{ fill: "#f59e0b", color: "#f59e0b", flexShrink: 0 }} />}
                        </div>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {art.feedName || "RSS Feed"}
                      </td>
                      <td>
                        {art.category ? (
                          <span className="status-badge status-draft">{art.category}</span>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>
                      <td className="hide-on-mobile" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {art.readDate ? new Date(art.readDate).toLocaleDateString() : "-"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <a
                          href={art.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm"
                          style={{ padding: "2px 6px" }}
                          title="Open original article"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
              <span>
                Page {page} of {totalPages}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn btn-sm"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Sync Provider */}
      {activeTab === "sync" && freshrssProvider && (
        <div style={{ maxWidth: "600px" }}>
          <ProviderCard provider={freshrssProvider} onRefresh={loadData} />
        </div>
      )}
    </div>
  );
}
