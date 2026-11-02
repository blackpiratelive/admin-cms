import Link from "next/link";
import { getDashboardData } from "@/features/dashboard/cache";
import { SystemStatsModule } from "@/features/stats/SystemStatsModule";
import { DashboardMediaWidgets } from "@/features/libraries/components/DashboardMediaWidgets";
import { RefreshDashboardButton } from "@/features/dashboard/RefreshDashboardButton";
import { getSessionUser } from "@/features/auth/session";
import { Plus, ShieldAlert, HeartPulse, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();

  // If user has role 'user', render personal hub with Health module access
  if (user?.role !== "superadmin") {
    return (
      <div style={{ maxWidth: "680px", margin: "40px auto", padding: "0 16px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 6px 0" }}>
            Welcome, @{user?.username || "user"}
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            Here are the modules currently available for your account.
          </p>
        </div>

        <Link
          href="/health"
          style={{
            display: "block",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              transition: "border-color 0.2s ease, transform 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "8px",
                  background: "rgba(249, 115, 22, 0.12)",
                  color: "var(--accent-primary, #f97316)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <HeartPulse size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px 0" }}>
                  Health & Hair Regrowth Tracker
                </h2>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                  Log daily Minoxidil doses, track adherence streaks, and upload weekly scalp progress photos.
                </p>
              </div>
            </div>
            <ArrowRight size={18} color="var(--text-muted)" />
          </div>
        </Link>
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
