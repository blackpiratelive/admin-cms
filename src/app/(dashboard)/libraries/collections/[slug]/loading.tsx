import React from "react";

export default function CollectionDetailLoading() {
  return (
    <div className="collection-detail" aria-busy="true" aria-label="Loading collection">
      <div className="collections-skeleton collections-skeleton-hero" />
      <div className="collections-skeleton collections-skeleton-tabs" />
      <div className="collections-skeleton collections-skeleton-panel" />
    </div>
  );
}
