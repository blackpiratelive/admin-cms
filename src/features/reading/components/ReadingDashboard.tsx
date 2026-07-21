"use client";

import { useEffect, useState } from "react";
import { ReadingAnalyticsData } from "@/features/analytics/types";
import { getAnalyticsProvider } from "@/features/analytics/providers";
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
  Sparkles,
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
      const provider = getAnalyticsProvider("reading");
      if (provider) {
        const stats = await provider.computeAnalytics();
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
        filter: historyFilter,
        category: selectedCategory || undefined,
        query: searchQuery || undefined,
        page,
        limit: 15,
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
  }, [historyFilter, selectedCategory, searchQuery, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--fg-primary)] flex items-center gap-2">
            <Rss className="text-[var(--accent-color)]" size={24} />
            Reading History & Discovery
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            Personal reading analytics, starred knowledge graph, and FreshRSS activity stream.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadData();
              loadHistory();
            }}
            className="btn btn-secondary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between text-[var(--fg-muted)] mb-2">
              <span className="text-xs font-medium">Total Read</span>
              <BookOpen size={16} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-[var(--fg-primary)]">{analytics.totalRead}</div>
            <div className="text-[11px] text-[var(--fg-muted)] mt-1">Lifetime articles</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between text-[var(--fg-muted)] mb-2">
              <span className="text-xs font-medium">Read Today</span>
              <Calendar size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-[var(--fg-primary)]">{analytics.readToday}</div>
            <div className="text-[11px] text-[var(--fg-muted)] mt-1">{analytics.readThisWeek} this week</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between text-[var(--fg-muted)] mb-2">
              <span className="text-xs font-medium">Reading Streak</span>
              <Flame size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-[var(--fg-primary)]">{analytics.streakDays} days</div>
            <div className="text-[11px] text-[var(--fg-muted)] mt-1">Longest: {analytics.longestStreakDays} days</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between text-[var(--fg-muted)] mb-2">
              <span className="text-xs font-medium">Reading Time</span>
              <Clock size={16} className="text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-[var(--fg-primary)]">
              {Math.round(analytics.totalEstimatedReadingTimeSeconds / 60)}m
            </div>
            <div className="text-[11px] text-[var(--fg-muted)] mt-1">Avg ~{analytics.averageReadingTimeSeconds}s/article</div>
          </div>

          <div className="card p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-[var(--fg-muted)] mb-2">
              <span className="text-xs font-medium">Starred</span>
              <Star size={16} className="text-yellow-500 fill-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-[var(--fg-primary)]">{analytics.totalStarred}</div>
            <div className="text-[11px] text-[var(--fg-muted)] mt-1">Saved to graph</div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--border-color)] flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          }`}
        >
          Overview & Sessions
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          }`}
        >
          Reading Stream
        </button>
        <button
          onClick={() => setActiveTab("starred")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "starred"
              ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          }`}
        >
          Starred Articles ({analytics?.totalStarred || 0})
        </button>
        <button
          onClick={() => setActiveTab("sync")}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === "sync"
              ? "border-[var(--accent-color)] text-[var(--accent-color)]"
              : "border-transparent text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          }`}
        >
          FreshRSS Provider
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Analytics & Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reading Sessions */}
            <div className="card p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <h3 className="text-base font-semibold text-[var(--fg-primary)] mb-3 flex items-center gap-2">
                <Clock size={18} className="text-[var(--accent-color)]" />
                Recent Reading Sessions
              </h3>
              <p className="text-xs text-[var(--fg-muted)] mb-4">
                Activity automatically grouped into dedicated reading sessions (30m threshold).
              </p>

              {analytics.readingSessions.length === 0 ? (
                <div className="text-xs text-[var(--fg-muted)] py-4 text-center">No reading sessions recorded yet. Sync FreshRSS to import activity.</div>
              ) : (
                <div className="space-y-3">
                  {analytics.readingSessions.slice(0, 5).map((session, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-[var(--fg-primary)]">
                          {new Date(session.startDate).toLocaleDateString()} at{" "}
                          {new Date(session.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-[var(--fg-muted)] mt-0.5">
                          {session.articlesCount} articles read • ~{session.wordCount} words
                        </div>
                      </div>
                      <div className="bg-[var(--bg-tertiary)] px-2.5 py-1 rounded text-[var(--fg-primary)] font-medium">
                        {session.durationMinutes} mins
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Categories & Feeds */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h3 className="text-sm font-semibold text-[var(--fg-primary)] mb-3 flex items-center gap-2">
                  <Tag size={16} className="text-emerald-500" />
                  Top Reading Categories
                </h3>
                <div className="space-y-2">
                  {analytics.topCategories.slice(0, 6).map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--fg-primary)]">{c.category}</span>
                      <span className="text-[var(--fg-muted)] font-medium">{c.count} articles</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h3 className="text-sm font-semibold text-[var(--fg-primary)] mb-3 flex items-center gap-2">
                  <Rss size={16} className="text-orange-500" />
                  Favorite Sources
                </h3>
                <div className="space-y-2">
                  {analytics.favoriteSources.slice(0, 6).map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--fg-primary)] truncate max-w-[180px]">{s.name}</span>
                      <span className="text-[var(--fg-muted)] font-medium">{s.count} reads</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Stats */}
          <div className="space-y-6">
            <div className="card p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
              <h3 className="text-sm font-semibold text-[var(--fg-primary)] mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-purple-500" />
                Reading Habits
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                  <span className="text-[var(--fg-muted)]">Most Active Day:</span>
                  <span className="font-semibold text-[var(--fg-primary)]">{analytics.mostActiveWeekday}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                  <span className="text-[var(--fg-muted)]">Peak Reading Hour:</span>
                  <span className="font-semibold text-[var(--fg-primary)]">{analytics.mostActiveReadingHour}:00</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                  <span className="text-[var(--fg-muted)]">Avg Reads / Day:</span>
                  <span className="font-semibold text-[var(--fg-primary)]">{analytics.averageArticlesPerDay}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                  <span className="text-[var(--fg-muted)]">Top Feed:</span>
                  <span className="font-semibold text-[var(--fg-primary)] truncate max-w-[140px]">
                    {analytics.mostReadFeed?.name || "None"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--fg-muted)]">Top Category:</span>
                  <span className="font-semibold text-[var(--fg-primary)]">
                    {analytics.mostReadCategory?.category || "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Sync Widget */}
            {freshrssProvider && (
              <div className="card p-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
                <h3 className="text-sm font-semibold text-[var(--fg-primary)] mb-2 flex items-center gap-2">
                  <Rss size={16} className="text-orange-500" />
                  FreshRSS Connection
                </h3>
                <p className="text-xs text-[var(--fg-muted)] mb-3">
                  Status: <span className="font-semibold text-[var(--accent-color)] capitalize">{freshrssProvider.status}</span>
                </p>
                <button
                  onClick={() => setActiveTab("sync")}
                  className="btn btn-secondary w-full text-xs"
                >
                  Manage FreshRSS Provider
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stream & Starred Tabs */}
      {(activeTab === "history" || activeTab === "starred") && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search size={16} className="text-[var(--fg-muted)]" />
              <input
                type="text"
                placeholder="Search articles, feeds, categories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs text-[var(--fg-primary)] focus:outline-none w-full"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              {activeTab === "history" && (
                <select
                  value={historyFilter}
                  onChange={(e: any) => {
                    setHistoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-1.5 text-[var(--fg-primary)] focus:outline-none"
                >
                  <option value="read">Read Only</option>
                  <option value="starred">Starred Only</option>
                  <option value="all">All Articles</option>
                </select>
              )}

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-1.5 text-[var(--fg-primary)] focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Article List */}
          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-[var(--fg-muted)]">Loading reading stream...</div>
          ) : articles.length === 0 ? (
            <div className="card p-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-center text-xs text-[var(--fg-muted)]">
              No reading history found matching your filters.
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((art) => (
                <div
                  key={art.id}
                  className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <BookOpen size={16} className="text-[var(--accent-color)] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <a
                        href={art.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm text-[var(--fg-primary)] hover:text-[var(--accent-color)] hover:underline block truncate"
                      >
                        {art.title}
                      </a>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)] mt-1">
                        <span className="font-medium">{art.feedName || "RSS"}</span>
                        {art.category && <span>• {art.category}</span>}
                        {art.readDate && <span>• Read {new Date(art.readDate).toLocaleDateString()}</span>}
                        {art.wordCount > 0 && <span>• ~{art.wordCount} words</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {art.isStarred && <Star size={15} className="fill-amber-400 text-amber-400" />}
                    <a
                      href={art.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded text-[var(--fg-muted)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-tertiary)]"
                      title="Open original URL"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-[var(--fg-muted)] pt-2">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn btn-secondary text-xs px-3 py-1 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="btn btn-secondary text-xs px-3 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync Provider Tab */}
      {activeTab === "sync" && freshrssProvider && (
        <div className="max-w-2xl">
          <ProviderCard provider={freshrssProvider} onRefresh={loadData} />
        </div>
      )}
    </div>
  );
}
