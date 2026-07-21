"use client";

import { useState, useEffect } from "react";
import { getSyncLogsAction } from "../actions";
import { SyncLogRecord } from "@/db/schema";
import Link from "next/link";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

export function SyncLogsView({ initialProvider }: { initialProvider?: string }) {
  const [selectedProvider, setSelectedProvider] = useState<string>(initialProvider || "");
  const [logs, setLogs] = useState<SyncLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getSyncLogsAction(selectedProvider || undefined, 1, 50);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedProvider]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <span className="status-badge status-connected" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <CheckCircle2 size={12} /> Success
          </span>
        );
      case "failed":
        return (
          <span className="status-badge status-error" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <XCircle size={12} /> Failed
          </span>
        );
      case "in_progress":
        return (
          <span className="status-badge status-syncing" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Clock size={12} className="animate-spin" /> In Progress
          </span>
        );
      default:
        return <span className="status-badge status-disconnected">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Link href="/sync" className="btn btn-sm" style={{ textDecoration: "none" }}>
              <ArrowLeft size={14} /> Back
            </Link>
            <span>Sync Audit Logs</span>
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Complete audit trail of all automated and manual provider data synchronization runs.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            className="select-input"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            style={{ width: "160px" }}
          >
            <option value="">All Providers</option>
            <option value="freshrss">FreshRSS</option>
            <option value="trakt">Trakt</option>
            <option value="lastfm">Last.fm</option>
          </select>

          <button className="btn btn-sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Started At</th>
              <th>Duration</th>
              <th>Items Created</th>
              <th>Items Updated</th>
              <th>Details & Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                  {loading ? "Loading sync logs..." : "No sync logs recorded yet."}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontWeight: "bold", textTransform: "capitalize" }}>
                    {log.provider === "trakt" ? "🎬 Trakt" : log.provider === "lastfm" ? "🎵 Last.fm" : log.provider}
                  </td>
                  <td>{getStatusBadge(log.status)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    {new Date(log.startedAt).toLocaleString()}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    {log.duration ? `${(log.duration / 1000).toFixed(2)}s` : "-"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{log.itemsCreated}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{log.itemsUpdated}</td>
                  <td>
                    {log.errorMessage ? (
                      <span style={{ color: "#c62828", fontSize: "12px", fontWeight: "500" }}>
                        Error: {log.errorMessage}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {log.metadataJson}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
