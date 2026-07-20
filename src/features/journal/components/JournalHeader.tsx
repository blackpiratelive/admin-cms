"use client";

import React, { useState } from "react";
import { useJournalAuth } from "../context/JournalAuthContext";
import {
  BookOpen,
  Lock,
  Search,
  Calendar as CalendarIcon,
  ListFilter,
  BarChart2,
  Plus,
  Settings,
  ShieldCheck,
  Download,
  Upload,
} from "lucide-react";

interface JournalHeaderProps {
  viewMode: "timeline" | "calendar" | "stats";
  onViewModeChange: (mode: "timeline" | "calendar" | "stats") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewEntry: () => void;
  onExportClick: () => void;
  onImportClick?: () => void;
  onSecurityClick?: () => void;
}

export function JournalHeader({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onNewEntry,
  onExportClick,
  onImportClick,
  onSecurityClick,
}: JournalHeaderProps) {
  const { lock, settings, updateAutoLock } = useJournalAuth();
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px 20px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              padding: "8px",
              borderRadius: "6px",
              backgroundColor: "rgba(249, 115, 22, 0.15)",
              color: "var(--accent)",
              display: "flex",
            }}
          >
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Personal Memory Vault</h1>
              <button
                onClick={onSecurityClick}
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(34, 197, 94, 0.15)",
                  color: "#22c55e",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  border: "none",
                  cursor: "pointer",
                }}
                title="View E2EE Security Settings"
              >
                <ShieldCheck size={12} />
                DEK/KEK E2EE Active
              </button>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Zero-knowledge encrypted life journal, reflections, & contextual memories.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onSecurityClick && (
            <button
              onClick={onSecurityClick}
              title="Journal Security & Encryption"
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <ShieldCheck size={15} style={{ color: "var(--accent)" }} />
              <span>Security</span>
            </button>
          )}

          <button
            onClick={onNewEntry}
            style={{
              padding: "8px 14px",
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={16} />
            <span>New Entry</span>
          </button>

          {onImportClick && (
            <button
              onClick={onImportClick}
              title="Import Journal Entries (.zip)"
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <Upload size={15} style={{ color: "var(--accent)" }} />
              <span>Import</span>
            </button>
          )}

          <button
            onClick={onExportClick}
            title="Export / Backup"
            style={{
              padding: "8px",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <Download size={16} />
          </button>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              title="Lock Settings"
              style={{
                padding: "8px",
                backgroundColor: "var(--bg-input)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                cursor: "pointer",
                display: "flex",
              }}
            >
              <Settings size={16} />
            </button>

            {showSettingsDropdown && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "6px",
                  width: "220px",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <label style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Auto Lock Inactivity
                </label>
                <select
                  value={settings?.autoLockMinutes ?? 15}
                  onChange={(e) => updateAutoLock(Number(e.target.value))}
                  style={{
                    padding: "6px",
                    backgroundColor: "var(--bg-input)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    color: "var(--text-primary)",
                    fontSize: "12px",
                  }}
                >
                  <option value={0}>Immediately</option>
                  <option value={5}>5 Minutes</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>1 Hour</option>
                  <option value={-1}>Manual Only</option>
                </select>
              </div>
            )}
          </div>

          <button
            onClick={lock}
            title="Lock Memory Vault Now"
            style={{
              padding: "8px 12px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Lock size={15} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Control Bar: View switch + Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", backgroundColor: "var(--bg-input)", borderRadius: "6px", padding: "3px" }}>
          <button
            onClick={() => onViewModeChange("timeline")}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: viewMode === "timeline" ? "var(--bg-card)" : "transparent",
              color: viewMode === "timeline" ? "var(--accent)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ListFilter size={14} />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => onViewModeChange("calendar")}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: viewMode === "calendar" ? "var(--bg-card)" : "transparent",
              color: viewMode === "calendar" ? "var(--accent)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CalendarIcon size={14} />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => onViewModeChange("stats")}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: viewMode === "stats" ? "var(--bg-card)" : "transparent",
              color: viewMode === "stats" ? "var(--accent)" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <BarChart2 size={14} />
            <span>Stats</span>
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "260px", flex: 1, maxWidth: "400px" }}>
          <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search decrypted entries (title, body, tags)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              backgroundColor: "var(--bg-input)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              color: "var(--text-primary)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
