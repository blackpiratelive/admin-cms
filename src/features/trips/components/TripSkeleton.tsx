import React from "react";

export function TripCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`trip-skeleton-${i}`}
          style={{
            border: "1px solid var(--border-color, #303030)",
            borderRadius: "14px",
            backgroundColor: "var(--bg-card, #1c1c1c)",
            overflow: "hidden",
            height: "360px",
            display: "flex",
            flexDirection: "column",
          }}
          aria-hidden="true"
        >
          <div className="trip-skeleton" style={{ height: "154px", width: "100%" }} />
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
            <div className="trip-skeleton" style={{ height: "14px", width: "70px" }} />
            <div className="trip-skeleton" style={{ height: "20px", width: "85%" }} />
            <div className="trip-skeleton" style={{ height: "12px", width: "55%" }} />
            <div className="trip-skeleton" style={{ height: "12px", width: "90%", marginTop: "6px" }} />
            <div className="trip-skeleton" style={{ height: "6px", width: "100%", marginTop: "auto" }} />
          </div>
        </div>
      ))}
    </>
  );
}

export function FeaturedTripSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--border-color, #303030)",
        borderRadius: "18px",
        overflow: "hidden",
        backgroundColor: "var(--bg-card, #1c1c1c)",
        height: "290px",
        marginBottom: "24px",
      }}
      aria-hidden="true"
    >
      <div className="trip-skeleton" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
