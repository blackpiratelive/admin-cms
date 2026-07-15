"use client";

import React, { useState } from "react";
import { refreshDashboardCacheAction } from "./cache";
import { RefreshCw } from "lucide-react";

export function RefreshDashboardButton({ updatedAt }: { updatedAt?: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDashboardCacheAction();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      {formattedTime && (
        <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          Cached {formattedTime}
        </span>
      )}
      <button
        type="button"
        onClick={handleRefresh}
        className="btn btn-sm"
        disabled={isRefreshing}
        title="Recalculate and update persistent dashboard snapshot in DB"
        style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
      >
        <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
        <span>Sync DB Cache</span>
      </button>
    </div>
  );
}
