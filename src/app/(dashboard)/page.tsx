import Link from "next/link";
import { getDashboardData } from "@/features/dashboard/cache";
import { SystemStatsModule } from "@/features/stats/SystemStatsModule";
import { DashboardMediaWidgets } from "@/features/libraries/components/DashboardMediaWidgets";
import { RefreshDashboardButton } from "@/features/dashboard/RefreshDashboardButton";
import { getSessionUser } from "@/features/auth/session";
import { Plus, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();

  // If user has role 'user' (no module access assigned), render empty state
  if (user?.role !== "superadmin") {
    return (
      <div style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center", padding: "32px 24px" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px auto",
            color: "var(--text-muted)",
          }}
        >
          <ShieldAlert size={28} />
        </div>
        <h1 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px 0" }}>
          Welcome, @{user?.username || "user"}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: "0 0 16px 0", lineHeight: 1.6 }}>
          Your account has been created successfully, but you currently do not have access to any modules.
        </p>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            padding: "16px",
            fontSize: "13px",
            color: "var(--text-muted)",
            lineHeight: 1.5,
            textAlign: "left",
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "var(--text-primary)" }}>
            No Module Access
          </p>
          <p style={{ margin: 0 }}>
            By default, new accounts start with zero module permissions. When the Super Admin configures access for your account, modules will become available here.
          </p>
        </div>
      </div>
    );
  }

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
                      <span className={`status-badge status-${post.status}`}>{post.status}</span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "12px" }}>
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
