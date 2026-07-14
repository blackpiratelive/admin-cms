export default function DashboardLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite" aria-label="Loading page">
      <div className="loading-bar" />
      <div className="loading-header shimmer" />
      <div className="loading-grid">
        <div className="loading-card shimmer" />
        <div className="loading-card shimmer" />
        <div className="loading-card shimmer" />
      </div>
      <span>Loading your workspace…</span>
    </div>
  );
}
