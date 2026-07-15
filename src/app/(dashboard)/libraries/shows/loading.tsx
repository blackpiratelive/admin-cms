import React from "react";

export default function ShowsLoading() {
  return (
    <div style={{ paddingBottom: "60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <div className="shimmer" style={{ width: "220px", height: "28px", borderRadius: "6px", marginBottom: "8px" }} />
          <div className="shimmer" style={{ width: "340px", height: "16px", borderRadius: "4px" }} />
        </div>
      </div>

      <div className="card" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px" }}>
        <div className="shimmer" style={{ flex: 1, height: "36px", borderRadius: "6px" }} />
        <div className="shimmer" style={{ width: "120px", height: "36px", borderRadius: "6px" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="card" style={{ padding: 0, overflow: "hidden", aspectRatio: "2/3.5" }}>
            <div className="shimmer" style={{ width: "100%", height: "70%" }} />
            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="shimmer" style={{ width: "80%", height: "16px", borderRadius: "4px" }} />
              <div className="shimmer" style={{ width: "40%", height: "12px", borderRadius: "4px" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
