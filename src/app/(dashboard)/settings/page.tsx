"use client";

import { useState } from "react";
import {
  Settings,
  Sliders,
  Palette,
  RefreshCw,
  HardDrive,
  Rocket,
  Shield,
  Image,
  Search,
  Cpu,
} from "lucide-react";

export default function CentralSettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "general" | "appearance" | "providers" | "storage" | "deployments" | "security" | "media" | "search" | "advanced"
  >("general");

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const tabs = [
    { id: "general", label: "General", icon: Sliders },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "providers", label: "Providers", icon: RefreshCw },
    { id: "storage", label: "Storage & R2", icon: HardDrive },
    { id: "deployments", label: "Deployments", icon: Rocket },
    { id: "security", label: "Security", icon: Shield },
    { id: "media", label: "Media & Processing", icon: Image },
    { id: "search", label: "Search Index", icon: Search },
    { id: "advanced", label: "Advanced System", icon: Cpu },
  ] as const;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }, 400);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Settings size={20} style={{ color: "var(--accent)" }} />
            <span>Central Settings Hub</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Configure global CMS settings, storage providers, security, deployment hooks, and system parameters.
          </p>
        </div>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : savedSuccess ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "20px" }}>
        {/* Navigation Tabs */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "8px",
            height: "fit-content",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "2px",
                  fontSize: "13px",
                  textAlign: "left",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-text)" : "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <IconComponent size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Section */}
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "20px",
            color: "var(--text-primary)",
          }}
        >
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                General Preferences
              </h2>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Platform Owner Name
                </label>
                <input
                  type="text"
                  defaultValue="Personal Admin"
                  className="text-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Hugo Website Public Domain
                </label>
                <input
                  type="text"
                  defaultValue="https://blackpiratelive.com"
                  className="text-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Default Content Visibility
                </label>
                <select className="select-input" defaultValue="public">
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Theme & Aesthetics
              </h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Use the top-right header selector to switch between built-in curated themes: HN Orange, Dark, Mono, and Teal.
              </p>
            </div>
          )}

          {activeTab === "providers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Provider Integrations
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>🎬 Trakt.tv</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Movies & TV Shows synchronization</div>
                  </div>
                  <span className="status-badge status-published">Connected</span>
                </div>

                <div
                  style={{
                    padding: "12px 16px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-sidebar)",
                    borderRadius: "4px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>🎵 Last.fm</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Scrobbles & Music metadata</div>
                  </div>
                  <span className="status-badge status-published">Connected</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "storage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Storage Architecture & Cloudflare R2
              </h2>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  R2 Bucket Name
                </label>
                <input
                  type="text"
                  defaultValue="gallery"
                  className="text-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Public Media Custom Domain
                </label>
                <input
                  type="text"
                  defaultValue="https://media.blackpiratex.com"
                  className="text-input"
                />
              </div>
            </div>
          )}

          {activeTab === "deployments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Vercel Deploy Hook Configuration
              </h2>
              <div className="form-group">
                <label className="form-label" style={{ color: "var(--text-secondary)" }}>
                  Deploy Hook URL
                </label>
                <input
                  type="password"
                  defaultValue="https://api.vercel.com/v1/integrations/deploy/..."
                  className="text-input"
                />
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Security & Session Settings
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Single-user administration protected via HTTP-Only JWT session token (`cms_session`).
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Media Processing Options
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Browser WebWorker image optimization creates derivative thumbnails (large, medium, small) automatically upon photo upload.
              </div>
            </div>
          )}

          {activeTab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Search Engine & Indexing
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Universal fuzzy search covers Microblogs, Gallery, Movies, TV Shows, Music, Projects, Locations, Trips & Collections.
              </div>
              <button className="btn" onClick={() => alert("Search index refreshed!")}>
                Re-index Knowledge Graph
              </button>
            </div>
          )}

          {activeTab === "advanced" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                Advanced Diagnostics
              </h2>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Database: SQLite / Turso libSQL
                <br />
                System Status: Operational
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
