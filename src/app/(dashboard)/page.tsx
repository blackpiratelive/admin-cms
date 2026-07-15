import Link from "next/link";
import { getDashboardData } from "@/features/dashboard/cache";
import { SystemStatsModule } from "@/features/stats/SystemStatsModule";
import { DashboardMediaWidgets } from "@/features/libraries/components/DashboardMediaWidgets";
import { RefreshDashboardButton } from "@/features/dashboard/RefreshDashboardButton";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboardData = await getDashboardData();
  const { microblogData, recentMovies, recentShows, recentScrobbles, activities, systemStats, updatedAt } = dashboardData;
  const { posts, total: totalPosts } = microblogData;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <RefreshDashboardButton updatedAt={updatedAt} />
          <Link href="/microblog/new" className="btn btn-primary">
            <Plus size={16} />
            <span>New Microblog</span>
          </Link>
        </div>
      </div>

      {/* Comprehensive System & Cloudflare R2 Stats Module */}
      <SystemStatsModule stats={systemStats} />

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
