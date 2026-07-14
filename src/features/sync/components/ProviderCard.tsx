"use client";

import { useState } from "react";
import { ProviderOverviewDTO, syncProviderAction, cancelProviderSyncAction } from "../actions";
import { ConfigureModal } from "./ConfigureModal";
import Link from "next/link";
import { RefreshCw, Settings, ListFilter, Square } from "lucide-react";

export function ProviderCard({
  provider,
  onRefresh,
}: {
  provider: ProviderOverviewDTO;
  onRefresh: () => void;
}) {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [syncMode, setSyncMode] = useState<"incremental" | "batch">("incremental");
  const [syncNotice, setSyncNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never";
    const date = new Date(iso);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
    return date.toLocaleDateString();
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncNotice(null);

    const res = await syncProviderAction(provider.slug, { mode: syncMode });
    setSyncing(false);

    if (res.success) {
      const created = res.itemsCreated ?? 0;
      const updated = res.itemsUpdated ?? 0;
      const createdStr = created > 0 ? `${created} added` : "";
      const updatedStr = updated > 0 ? `${updated} updated` : "";
      const msg = [createdStr, updatedStr].filter(Boolean).join(", ") || "Up to date";
      setSyncNotice({ type: "success", message: `Sync successful! ${msg}` });
      onRefresh();
    } else {
      setSyncNotice({ type: "error", message: res.errorMessage || "Sync failed" });
      onRefresh();
    }
  };

  const handleStopSync = async () => {
    setCancelling(true);
    const res = await cancelProviderSyncAction(provider.slug);
    setCancelling(false);
    setSyncing(false);

    if (res.success) {
      setSyncNotice({ type: "error", message: "Sync stopped by user." });
      onRefresh();
    }
  };

  const isSyncingActive = syncing || provider.status === "syncing";
  const statusClass = `status-${provider.status}`;

  return (
    <div className="sync-card">
      <div>
        <div className="sync-card-header">
          <div className="sync-card-title">
            <span className="sync-card-icon">{provider.icon}</span>
            <div>
              <div>{provider.name}</div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal" }}>
                Last sync: {formatLastSync(provider.lastSync)}
              </span>
            </div>
          </div>
          <span className={`status-badge ${statusClass}`}>{provider.status}</span>
        </div>

        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "12px 0" }}>
          {provider.description}
        </p>

        {/* Statistics Grid */}
        <div className="sync-stats-grid">
          {Object.entries(provider.stats).length > 0 ? (
            Object.entries(provider.stats).map(([label, val]) => (
              <div key={label} className="sync-stat-item">
                <span className="sync-stat-label">{label}</span>
                <span className="sync-stat-value">{Number(val).toLocaleString()}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
              No items imported yet
            </div>
          )}
        </div>

        {syncNotice && (
          <div
            style={{
              marginTop: "12px",
              padding: "6px 10px",
              borderRadius: "2px",
              fontSize: "12px",
              background: syncNotice.type === "success" ? "#e8f5e9" : "#ffebee",
              color: syncNotice.type === "success" ? "#2e7d32" : "#c62828",
              border: `1px solid ${syncNotice.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
            }}
          >
            {syncNotice.message}
          </div>
        )}
      </div>

      <div className="sync-card-footer">
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {provider.slug === "lastfm" && provider.connected && !isSyncingActive && (
            <select
              className="select-input"
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value as any)}
              style={{ padding: "3px 6px", fontSize: "11px", width: "auto" }}
              disabled={isSyncingActive}
            >
              <option value="incremental">Incremental</option>
              <option value="batch">Batch History</option>
            </select>
          )}

          {isSyncingActive ? (
            <button
              className="btn btn-sm btn-danger"
              onClick={handleStopSync}
              disabled={cancelling}
              title="Stop current sync execution"
            >
              <Square size={13} fill="currentColor" />
              <span>{cancelling ? "Stopping..." : "Stop Sync"}</span>
            </button>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSync}
              disabled={!provider.connected}
            >
              <RefreshCw size={13} />
              <span>Sync Now</span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button className="btn btn-sm" onClick={() => setShowConfigModal(true)} title="Configure Credentials">
            <Settings size={13} />
            <span>Configure</span>
          </button>

          <Link href={`/sync/logs?provider=${provider.slug}`} className="btn btn-sm" title="View Provider Sync Logs">
            <ListFilter size={13} />
            <span>Logs</span>
          </Link>
        </div>
      </div>

      {showConfigModal && (
        <ConfigureModal
          provider={provider}
          onClose={() => setShowConfigModal(false)}
          onUpdated={onRefresh}
        />
      )}
    </div>
  );
}
