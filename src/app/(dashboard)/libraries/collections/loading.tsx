import React from "react";

export default function CollectionsLoading() {
  return (
    <div className="collections-hub" aria-busy="true" aria-label="Loading collections">
      <header className="collections-header">
        <div className="collections-header-copy" style={{ width: "100%" }}>
          <div className="collections-skeleton" style={{ width: 84, height: 12 }} />
          <div className="collections-skeleton collections-skeleton-title" />
          <div className="collections-skeleton collections-skeleton-sub" />
        </div>
      </header>

      <div className="collections-stats">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="collections-skeleton collections-skeleton-stat" />
        ))}
      </div>

      <div className="collections-skeleton collections-skeleton-featured" />
      <div className="collections-skeleton collections-skeleton-toolbar" />

      <div className="collections-section-head">
        <div className="collections-skeleton" style={{ width: 160, height: 18 }} />
      </div>

      <div className="collections-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="collections-skeleton collections-skeleton-card" />
        ))}
      </div>
    </div>
  );
}
