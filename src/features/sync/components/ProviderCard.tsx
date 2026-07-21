"use client";

import { useState, useRef, useEffect } from "react";
import { ProviderOverviewDTO, syncProviderAction, cancelProviderSyncAction, getSyncLogsAction } from "../actions";
import { ConfigureModal } from "./ConfigureModal";
import Link from "next/link";
import { RefreshCw, Settings, ListFilter, Square, Calculator, Terminal } from "lucide-react";

interface LogEntry {
  time: string;
  message: string;
}

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
  const [syncTarget, setSyncTarget] = useState<"scrobbles" | "artists" | "albums" | "tracks" | "all">("scrobbles");
  const [syncNotice, setSyncNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Live Terminal Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogsTerminal, setShowLogsTerminal] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showLogsTerminal && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, showLogsTerminal]);

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

  const handleFetchLocalLogs = async () => {
    setShowLogsTerminal(true);
    setLogs([{ time: new Date().toLocaleTimeString(), message: `Fetching local DB audit logs for ${provider.name}...` }]);
    try {
      const dbLogs = await getSyncLogsAction(provider.slug, 1, 30);
      if (dbLogs.length === 0) {
        setLogs([{ time: new Date().toLocaleTimeString(), message: "No local DB audit logs recorded yet." }]);
      } else {
        setLogs(
          dbLogs.map((l) => ({
            time: new Date(l.startedAt).toLocaleTimeString(),
            message: `[${l.status.toUpperCase()}] ${l.provider} sync: ${l.itemsCreated} created, ${l.itemsUpdated} updated${l.errorMessage ? ` - ${l.errorMessage}` : ""}`,
          }))
        );
      }
    } catch (err: any) {
      setLogs([{ time: new Date().toLocaleTimeString(), message: `[ERROR] Error reading DB logs: ${err.message}` }]);
    }
  };

  const executeStreamAction = async (payload: { slug?: string; action?: string; target?: string; mode?: string; batchSize?: number }) => {
    setSyncing(true);
    setSyncNotice(null);
    setShowLogsTerminal(true);
    setLogs([{ time: new Date().toLocaleTimeString(), message: `Connecting to ${provider.name} stream...` }]);

    const endpoint = payload.action === "calculate_dates" ? "/api/sync/lastfm/stream" : "/api/sync/stream";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: provider.slug, ...payload }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Server returned HTTP ${response.status} (${response.statusText}): ${text || "Request failed"}`);
      }

      if (!response.body) {
        throw new Error("Streaming response body unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.type === "log") {
                setLogs((prev) => [...prev, { time: data.time, message: data.message }]);
              } else if (data.type === "done") {
                if (data.success) {
                  const created = data.result?.itemsCreated ?? 0;
                  const updated = data.result?.itemsUpdated ?? 0;
                  const createdStr = created > 0 ? `${created} added` : "";
                  const updatedStr = updated > 0 ? `${updated} updated` : "";
                  const msg = [createdStr, updatedStr].filter(Boolean).join(", ") || "Up to date";
                  setSyncNotice({ type: "success", message: `Sync successful! ${msg}` });
                } else {
                  setSyncNotice({ type: "error", message: data.error || "Execution failed." });
                }
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setSyncNotice({ type: "error", message: err.message || "Streaming failed." });
      setLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: `[ERROR] Stream error: ${err.message || String(err)}` },
      ]);
    } finally {
      setSyncing(false);
      onRefresh();
    }
  };

  const handleSync = async () => {
    await executeStreamAction({
      slug: provider.slug,
      target: syncTarget,
      mode: syncMode,
      batchSize: 50,
    });
  };

  const handleCalculateDatesManually = async () => {
    await executeStreamAction({ action: "calculate_dates" });
  };

  const handleStopSync = async () => {
    setCancelling(true);
    const res = await cancelProviderSyncAction(provider.slug);
    setCancelling(false);
    setSyncing(false);

    if (res.success) {
      setSyncNotice({ type: "error", message: "Sync stopped by user." });
      setLogs((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), message: "[WARN] Sync execution cancelled by user." },
      ]);
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

        {/* FreshRSS & Trakt Options Panel */}
        {(provider.slug === "freshrss" || provider.slug === "trakt") && provider.connected && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {provider.name} Sync Options & Mode
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>Sync Mode</label>
                <select
                  className="select-input"
                  value={syncMode}
                  onChange={(e) => setSyncMode(e.target.value as any)}
                  style={{ padding: "3px 6px", fontSize: "11px", width: "auto" }}
                  disabled={isSyncingActive}
                >
                  <option value="incremental">Incremental Sync</option>
                  <option value="batch">Batch History (Deep Fetch)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Last.fm Options Panel */}
        {provider.slug === "lastfm" && provider.connected && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Sync Options & Target Selection
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>Target</label>
                <select
                  className="select-input"
                  value={syncTarget}
                  onChange={(e) => setSyncTarget(e.target.value as any)}
                  style={{ padding: "3px 6px", fontSize: "11px", width: "auto" }}
                  disabled={isSyncingActive}
                >
                  <option value="scrobbles">Scrobbles (Listening History)</option>
                  <option value="artists">Artists (API Total Plays)</option>
                  <option value="albums">Albums (API Total Plays)</option>
                  <option value="tracks">Tracks (API Total Plays)</option>
                  <option value="all">All (Full Sync)</option>
                </select>
              </div>

              {(syncTarget === "scrobbles" || syncTarget === "all") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>Mode</label>
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
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginLeft: "auto" }}>
                <label style={{ fontSize: "10px", color: "var(--text-muted)" }}>Manual Date Calc</label>
                <button
                  className="btn btn-sm"
                  onClick={handleCalculateDatesManually}
                  disabled={isSyncingActive}
                  title="Calculate first & last played dates from local scrobbles"
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                >
                  <Calculator size={12} />
                  <span>Calculate Dates</span>
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Live Terminal Log Viewer */}
        {showLogsTerminal && (
          <div style={{ marginTop: "12px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: "bold",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Terminal size={12} />
                <span>Sync Terminal & Execution Logs</span>
              </div>
              <button
                className="btn btn-sm"
                style={{ padding: "2px 6px", fontSize: "10px" }}
                onClick={() => setShowLogsTerminal(false)}
              >
                Hide Logs
              </button>
            </div>
            <div className="sync-log-terminal">
              {logs.map((log, idx) => {
                const isErr = log.message.includes("[ERROR]") || log.message.toLowerCase().includes("error");
                const isWarn = log.message.includes("[WARN]");
                const isSuccess = log.message.includes("completed") || log.message.includes("successfully") || log.message.includes("[SUCCESS]");
                return (
                  <div key={idx} className="sync-log-line">
                    <span className="sync-log-time">[{log.time}]</span>
                    <span
                      className="sync-log-msg"
                      style={{
                        color: isErr ? "#ff6b6b" : isWarn ? "#ffd166" : isSuccess ? "#51cf66" : "#e6edf3",
                        fontWeight: isErr ? "bold" : "normal",
                      }}
                    >
                      {log.message}
                    </span>
                  </div>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          </div>
        )}
      </div>

      <div className="sync-card-footer">
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
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
          ) : provider.slug !== "bluesky" && provider.slug !== "mastodon" ? (
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSync}
              disabled={!provider.connected}
            >
              <RefreshCw size={13} className={isSyncingActive ? "spin" : ""} />
              <span>Sync Now</span>
            </button>
          ) : null}

          <button
            className="btn btn-sm"
            onClick={handleFetchLocalLogs}
            title="Inspect local DB audit logs"
          >
            <Terminal size={12} />
            <span>Local Logs</span>
          </button>
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button className="btn btn-sm" onClick={() => setShowConfigModal(true)} title="Configure Credentials">
            <Settings size={13} />
            <span>Configure</span>
          </button>

          <Link href={`/sync/logs?provider=${provider.slug}`} className="btn btn-sm" title="View Full Provider Sync Audit Page">
            <ListFilter size={13} />
            <span>Audit Trail</span>
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
