import React from "react";

export default function MusicLoading() {
  return (
    <div style={{ paddingBottom: "60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div className="shimmer" style={{ width: "220px", height: "28px", borderRadius: "6px", marginBottom: "8px" }} />
          <div className="shimmer" style={{ width: "340px", height: "16px", borderRadius: "4px" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="shimmer" style={{ width: "48px", height: "48px", borderRadius: "50%" }} />
            <div className="shimmer" style={{ width: "70%", height: "16px", borderRadius: "4px" }} />
            <div className="shimmer" style={{ width: "40%", height: "12px", borderRadius: "4px" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
