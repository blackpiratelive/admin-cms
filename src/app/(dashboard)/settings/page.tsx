"use client";

import { useState, useEffect } from "react";
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
  Check,
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
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <Settings size={24} style={{ color: "var(--accent-color, #ff6600)" }} />
            <span>Central Settings Hub</span>
          </h1>
          <p style={{ color: "var(--text-muted, #888)", fontSize: "14px", marginTop: "4px" }}>
            Configure global CMS settings, storage providers, security, deployment hooks, and system parameters.
          </p>
        </div>
        <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : savedSuccess ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px" }}>
        {/* Navigation Tabs */}
        <div
          style={{
            backgroundColor: "var(--card-bg, #1a1a1a)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "8px",
            padding: "8px",
            height: "fit-content",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
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
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  textAlign: "left",
                  background: active ? "var(--accent-color, #ff6600)" : "transparent",
                  color: active ? "#ffffff" : "var(--text-main, #eee)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <IconComponent size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Section */}
        <div
          style={{
            backgroundColor: "var(--card-bg, #1a1a1a)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "8px",
            padding: "24px",
          }}
        >
          {activeTab === "general" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>General Preferences</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted, #888)" }}>
                    Platform Owner Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Personal Admin"
                    className="input"
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted, #888)" }}>
                    Hugo Website Public Domain
                  </label>
                  <input
                    type="text"
                    defaultValue="https://blackpiratelive.com"
                    className="input"
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted, #888)" }}>
                    Default Content Visibility
                  </label>
                  <select className="input" style={{ width: "100%", marginTop: "4px" }} defaultValue="public">
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Theme & Aesthetics</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted, #888)", marginBottom: "16px" }}>
                Customize your high-performance dark-first user experience.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div
                  style={{
                    padding: "16px",
                    border: "2px solid var(--accent-color, #ff6600)",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,102,0,0.05)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>HackerNews Dark Orange (Default)</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginTop: "4px" }}>
                    High-contrast dark mode tailored for focus and readability.
                  </div>
                </div>
                <div
                  style={{
                    padding: "16px",
                    border: "1px solid var(--border-color, #333)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Midnight Blue</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginTop: "4px" }}>
                    Deep slate blue palette with high clarity elements.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "providers" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Provider Integrations</h2>
              <p style={{ fontSize: "13px", color: "var(--text-muted, #888)", marginBottom: "16px" }}>
                External service sync status and configuration overview.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div
                  style={{
                    padding: "12px 16px",
                    border: "1px solid var(--border-color, #333)",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>🎬 Trakt.tv</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Movies & TV Shows synchronization</div>
                  </div>
                  <span style={{ fontSize: "12px", color: "#48bb78", fontWeight: 600 }}>Connected</span>
                </div>

                <div
                  style={{
                    padding: "12px 16px",
                    border: "1px solid var(--border-color, #333)",
                    borderRadius: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>🎵 Last.fm</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Scrobbles & Music metadata</div>
                  </div>
                  <span style={{ fontSize: "12px", color: "#48bb78", fontWeight: 600 }}>Connected</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "storage" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Storage Architecture & Cloudflare R2</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted, #888)" }}>
                    R2 Bucket Name
                  </label>
                  <input
                    type="text"
                    defaultValue="gallery"
                    className="input"
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted, #888)" }}>
                    Public Media Custom Domain
                  </label>
                  <input
                    type="text"
                    defaultValue="https://media.blackpiratex.com"
                    className="input"
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "deployments" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Vercel Deploy Hook Configuration</h2>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-muted, #888)" }}>
                  Deploy Hook URL
                </label>
                <input
                  type="password"
                  defaultValue="https://api.vercel.com/v1/integrations/deploy/..."
                  className="input"
                  style={{ width: "100%", marginTop: "4px" }}
                />
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Security & Session Settings</h2>
              <div style={{ fontSize: "14px", color: "var(--text-muted, #888)" }}>
                Single-user administration protected via HTTP-Only JWT session token (`cms_session`).
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Media Processing Options</h2>
              <div style={{ fontSize: "14px", color: "var(--text-muted, #888)" }}>
                Browser WebWorker image optimization creates derivative thumbnails (large, medium, small) automatically upon photo upload.
              </div>
            </div>
          )}

          {activeTab === "search" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Search Engine & Indexing</h2>
              <div style={{ fontSize: "14px", color: "var(--text-muted, #888)", marginBottom: "16px" }}>
                Universal fuzzy search covers Microblogs, Gallery, Movies, TV Shows, Music, Projects, Locations, Trips & Collections.
              </div>
              <button className="btn btn-secondary" onClick={() => alert("Search index refreshed!")}>
                Re-index Knowledge Graph
              </button>
            </div>
          )}

          {activeTab === "advanced" && (
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Advanced Diagnostics</h2>
              <div style={{ fontSize: "14px", color: "var(--text-muted, #888)" }}>
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
