"use client";

import React from "react";
import { CombinedMovie, CombinedShow } from "../types";
import { LastfmScrobbleRecord, ActivityRecord } from "@/db/schema";
import { getTmdbImageUrl } from "../utils/images";
import { Film, Tv, Radio, Activity, ArrowRight, Star, Heart } from "lucide-react";
import Link from "next/link";

interface DashboardMediaWidgetsProps {
  recentMovies: CombinedMovie[];
  recentShows: CombinedShow[];
  recentScrobbles: LastfmScrobbleRecord[];
  activities: ActivityRecord[];
}

export function DashboardMediaWidgets({
  recentMovies,
  recentShows,
  recentScrobbles,
  activities,
}: DashboardMediaWidgetsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Media Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {/* 1. Recently Watched Movies Widget */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
              <Film size={16} style={{ color: "var(--accent-color)" }} />
              <span>Recently Watched Movies</span>
            </div>
            <Link href="/libraries/movies" style={{ fontSize: "12px", color: "var(--accent-color)", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
              View All <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentMovies.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px 0" }}>No movies synced yet.</div>
            )}
            {recentMovies.slice(0, 4).map((m) => (
              <Link
                key={m.movie.traktId}
                href={`/libraries/movies/${m.movie.traktId}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textDecoration: "none",
                  color: "inherit",
                  padding: "6px",
                  borderRadius: "6px",
                  background: "var(--bg-color)",
                }}
              >
                <img
                  src={getTmdbImageUrl(m.movie.posterPath, "poster") || "https://placehold.co/40x60/111/fff?text=Film"}
                  alt={m.movie.title}
                  style={{ width: "36px", height: "54px", objectFit: "cover", borderRadius: "4px" }}
                  loading="lazy"
                  decoding="async"
                />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.movie.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {m.movie.year || "N/A"} {m.movie.rating ? `• ★ ${m.movie.rating.toFixed(1)}` : ""}
                  </div>
                </div>
                {m.metadata?.favorite === 1 && <Heart size={12} fill="var(--accent-color)" color="var(--accent-color)" />}
              </Link>
            ))}
          </div>
        </div>

        {/* 2. TV Shows Widget */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
              <Tv size={16} style={{ color: "var(--accent-color)" }} />
              <span>TV Shows Library</span>
            </div>
            <Link href="/libraries/shows" style={{ fontSize: "12px", color: "var(--accent-color)", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
              View All <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {recentShows.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px 0" }}>No TV shows synced yet.</div>
            )}
            {recentShows.slice(0, 4).map((s) => (
              <Link
                key={s.show.traktId}
                href={`/libraries/shows/${s.show.traktId}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  textDecoration: "none",
                  color: "inherit",
                  padding: "6px",
                  borderRadius: "6px",
                  background: "var(--bg-color)",
                }}
              >
                <img
                  src={getTmdbImageUrl(s.show.posterPath, "poster") || "https://placehold.co/40x60/111/fff?text=TV"}
                  alt={s.show.title}
                  style={{ width: "36px", height: "54px", objectFit: "cover", borderRadius: "4px" }}
                  loading="lazy"
                  decoding="async"
                />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.show.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {s.show.status || "Ongoing"} • {s.episodes.length} eps
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 3. Recently Played Scrobbles */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
              <Radio size={16} style={{ color: "var(--accent-color)" }} />
              <span>Recent Music Scrobbles</span>
            </div>
            <Link href="/libraries/music" style={{ fontSize: "12px", color: "var(--accent-color)", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
              View Music <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentScrobbles.length === 0 && (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px 0" }}>No scrobbles synced yet.</div>
            )}
            {recentScrobbles.slice(0, 5).map((sc) => (
              <div
                key={sc.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  background: "var(--bg-color)",
                  fontSize: "12px",
                }}
              >
                <div style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", marginRight: "8px" }}>
                  <span style={{ fontWeight: 600 }}>{sc.track}</span>{" "}
                  <span style={{ color: "var(--text-muted)" }}>by {sc.artist}</span>
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>
                  {new Date(sc.playedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Timeline Widget */}
      {activities.length > 0 && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
            <Activity size={16} style={{ color: "var(--accent-color)" }} />
            <span>Personal Activity Stream</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activities.slice(0, 6).map((act) => (
              <div
                key={act.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  borderLeft: "3px solid var(--accent-color)",
                  background: "var(--bg-color)",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{act.title}</span>
                  <span style={{ color: "var(--text-muted)", marginLeft: "8px", textTransform: "capitalize" }}>
                    ({act.action.replace("_", " ")})
                  </span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                  {new Date(act.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
