import Link from "next/link";
import { getMicroblogs } from "@/features/microblog/actions";
import { getMoviesAction } from "@/features/libraries/actions/movies";
import { getShowsAction } from "@/features/libraries/actions/shows";
import { getListeningHistoryAction } from "@/features/libraries/actions/music";
import { getActivitiesAction } from "@/features/libraries/actions/activities";
import { DashboardMediaWidgets } from "@/features/libraries/components/DashboardMediaWidgets";
import { Plus, MessageSquareText, Globe, FileEdit, Archive, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const posts = await getMicroblogs();

  const [recentMovies, recentShows, recentScrobbles, activities] = await Promise.all([
    getMoviesAction({ timeframe: "recently_watched" }),
    getShowsAction(),
    getListeningHistoryAction({ limit: 5 }),
    getActivitiesAction(6),
  ]);

  const totalPosts = posts.length;
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <Link href="/microblog/new" className="btn btn-primary">
          <Plus size={16} />
          <span>New Microblog</span>
        </Link>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Total Microblogs</div>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>{totalPosts}</div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Published</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2e7d32" }}>{publishedCount}</div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Drafts</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-secondary)" }}>{draftCount}</div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Scheduled</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0288d1" }}>{scheduledCount}</div>
        </div>
      </div>

      {/* Media & Personal Libraries Dashboard Widgets */}
      <DashboardMediaWidgets
        recentMovies={recentMovies}
        recentShows={recentShows}
        recentScrobbles={recentScrobbles}
        activities={activities}
      />

      {/* Quick Access & Recent Posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "15px", fontWeight: "bold" }}>Recent Content</h2>
          <Link href="/microblog" style={{ fontSize: "13px" }}>
            View all ({totalPosts}) &rarr;
          </Link>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Snippet</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                    No posts created yet. Click "New Microblog" above to get started.
                  </td>
                </tr>
              ) : (
                posts.slice(0, 5).map((post) => (
                  <tr key={post.id}>
                    <td>
                      <Link href={`/microblog/${post.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>
                        {post.contentMarkdown.slice(0, 50)}...
                      </Link>
                    </td>
                    <td>
                      <span className={`status-badge status-${post.status}`}>
                        {post.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {new Date(post.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
