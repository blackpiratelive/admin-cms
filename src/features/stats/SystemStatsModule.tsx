"use client";

import React from "react";
import { type ComprehensiveSystemStats } from "./actions";
import {
  Cloud,
  HardDrive,
  Database,
  Image as ImageIcon,
  Film,
  Tv,
  Music,
  MapPin,
  Compass,
  FolderKanban,
  CheckSquare,
  FileText,
  Shield,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

interface SystemStatsModuleProps {
  stats: ComprehensiveSystemStats;
  title?: string;
}

export function SystemStatsModule({ stats, title = "System Stats & Cloudflare R2 Monitor" }: SystemStatsModuleProps) {
  const { r2Stats, counts } = stats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity size={18} style={{ color: "var(--accent)" }} />
          <span>{title}</span>
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`status-badge status-${r2Stats.configured ? "published" : "draft"}`}>
            {r2Stats.configured ? "R2 Storage Connected" : "Local Dev Fallback"}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Turso DB Active
          </span>
        </div>
      </div>

      {/* Cloudflare R2 Storage Stats Banner Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "6px",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ background: "var(--bg-sidebar)", padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)" }}>
              <Cloud size={20} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                Cloudflare R2 Object Storage
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                Bucket: <code style={{ color: "var(--accent)" }}>{r2Stats.bucketName}</code>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text-primary)" }}>
              {r2Stats.usedFormatted}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {r2Stats.storageLimitFormatted}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px", color: "var(--text-secondary)" }}>
            <span>Storage Capacity Used</span>
            <span><strong>{r2Stats.percentStorageUsed}%</strong></span>
          </div>
          <div style={{ width: "100%", height: "8px", background: "var(--border-color)", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max(1, r2Stats.percentStorageUsed)}%`,
                backgroundColor: r2Stats.percentStorageUsed > 85 ? "#d32f2f" : "var(--accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* 4 Storage Metric Sub-cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
          <div style={{ background: "var(--bg-sidebar)", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Stored Gallery Photos</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "2px" }}>{r2Stats.totalPhotos} Photos</div>
          </div>

          <div style={{ background: "var(--bg-sidebar)", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Total Derivative Objects</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "2px" }}>{r2Stats.totalObjects} Files</div>
          </div>

          <div style={{ background: "var(--bg-sidebar)", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Class A Ops Limit</div>
            <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "4px", color: "#2e7d32" }}>{r2Stats.classALimitFormatted}</div>
          </div>

          <div style={{ background: "var(--bg-sidebar)", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "bold" }}>Class B Ops Limit</div>
            <div style={{ fontSize: "12px", fontWeight: "bold", marginTop: "4px", color: "#2e7d32" }}>{r2Stats.classBLimitFormatted}</div>
          </div>
        </div>
      </div>

      {/* Entity & Knowledge Graph Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <Link href="/microblog" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><FileText size={14} /> Microblogs</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.microblogsTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {counts.microblogsPublished} published • {counts.microblogsDrafts} drafts
            </div>
          </div>
        </Link>

        <Link href="/gallery" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><ImageIcon size={14} /> Gallery Items</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.photosTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {counts.photosPublic} public photos
            </div>
          </div>
        </Link>

        <Link href="/libraries/movies" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Film size={14} /> Movies</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.moviesTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Movies logged & reviewed
            </div>
          </div>
        </Link>

        <Link href="/libraries/shows" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Tv size={14} /> TV Shows</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.showsTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Shows tracked
            </div>
          </div>
        </Link>

        <Link href="/locations" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={14} /> Locations</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.locationsTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Geographical pins
            </div>
          </div>
        </Link>

        <Link href="/trips" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Compass size={14} /> Trips</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.tripsTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Travel itineraries
            </div>
          </div>
        </Link>

        <Link href="/todos" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><FolderKanban size={14} /> Projects & Tasks</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.projectsTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {counts.openTodos} open todo tasks
            </div>
          </div>
        </Link>

        <Link href="/libraries/music" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "14px", borderRadius: "4px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)", fontSize: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Music size={14} /> Scrobbles</span>
              <ArrowUpRight size={14} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{counts.scrobblesTotal}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Last.fm track scrobbles
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
