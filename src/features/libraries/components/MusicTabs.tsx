"use client";

import React, { useState } from "react";
import { CombinedArtist, CombinedAlbum, CombinedTrack } from "../types";
import { LastfmScrobbleRecord } from "@/db/schema";
import { updateArtistMetadataAction, updateAlbumMetadataAction, updateTrackMetadataAction } from "../actions/music";
import { Music, Disc, Radio, Clock, Heart, Search, Star, Tag, Eye } from "lucide-react";
import Link from "next/link";

interface MusicTabsProps {
  artists: CombinedArtist[];
  albums: CombinedAlbum[];
  tracks: CombinedTrack[];
  history: LastfmScrobbleRecord[];
  activeTab: "artists" | "albums" | "tracks" | "history";
}

export function MusicTabs({ artists, albums, tracks, history, activeTab: initialTab }: MusicTabsProps) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  // Filter lists
  const filteredArtists = artists.filter((a) => {
    if (favoriteOnly && a.metadata?.favorite !== 1) return false;
    if (query) return a.artist.artistName.toLowerCase().includes(query.toLowerCase());
    return true;
  });

  const filteredAlbums = albums.filter((alb) => {
    if (favoriteOnly && alb.metadata?.favorite !== 1) return false;
    if (query) return alb.album.albumName.toLowerCase().includes(query.toLowerCase()) || alb.album.artist.toLowerCase().includes(query.toLowerCase());
    return true;
  });

  const filteredTracks = tracks.filter((tr) => {
    if (favoriteOnly && tr.metadata?.favorite !== 1 && tr.metadata?.loved !== 1) return false;
    if (query) return tr.track.trackName.toLowerCase().includes(query.toLowerCase()) || tr.track.artist.toLowerCase().includes(query.toLowerCase());
    return true;
  });

  const filteredHistory = history.filter((h) => {
    if (query) return h.track.toLowerCase().includes(query.toLowerCase()) || h.artist.toLowerCase().includes(query.toLowerCase()) || h.album?.toLowerCase().includes(query.toLowerCase());
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Header & Tab Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", background: "var(--bg-card)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <button
            className={`btn btn-sm ${tab === "artists" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("artists")}
            style={{ border: "none" }}
          >
            <Music size={14} /> Artists ({artists.length})
          </button>

          <button
            className={`btn btn-sm ${tab === "albums" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("albums")}
            style={{ border: "none" }}
          >
            <Disc size={14} /> Albums ({albums.length})
          </button>

          <button
            className={`btn btn-sm ${tab === "tracks" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("tracks")}
            style={{ border: "none" }}
          >
            <Radio size={14} /> Tracks ({tracks.length})
          </button>

          <button
            className={`btn btn-sm ${tab === "history" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("history")}
            style={{ border: "none" }}
          >
            <Clock size={14} /> History ({history.length})
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative", width: "220px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              className="text-input"
              placeholder={`Search ${tab}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: "32px", fontSize: "12px" }}
            />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
            <input type="checkbox" checked={favoriteOnly} onChange={(e) => setFavoriteOnly(e.target.checked)} />
            <Heart size={14} fill={favoriteOnly ? "var(--accent-color)" : "none"} color={favoriteOnly ? "var(--accent-color)" : "currentColor"} />
            <span>Favorites</span>
          </label>
        </div>
      </div>

      {/* Content Renderers */}
      {/* 1. Artists Grid */}
      {tab === "artists" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {filteredArtists.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No artists found.
            </div>
          )}
          {filteredArtists.map((a) => (
            <div key={a.artist.artistName} className="card card-hover" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--accent-color)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "18px",
                  }}
                >
                  {a.artist.artistName[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <Link
                    href={`/libraries/music/artists/${encodeURIComponent(a.artist.artistName)}`}
                    style={{ fontWeight: 600, fontSize: "14px", textDecoration: "none", color: "inherit" }}
                  >
                    {a.artist.artistName}
                  </Link>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{a.artist.playCount} scrobbles</div>
                </div>
                {a.metadata?.favorite === 1 && <Heart size={14} fill="var(--accent-color)" color="var(--accent-color)" />}
              </div>

              <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>Last: {a.artist.lastPlayed ? new Date(a.artist.lastPlayed).toLocaleDateString() : "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Albums Grid */}
      {tab === "albums" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {filteredAlbums.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No albums found.
            </div>
          )}
          {filteredAlbums.map((alb) => (
            <div key={alb.album.id} className="card card-hover" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: "6px", background: "var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Disc size={36} style={{ color: "var(--text-muted)" }} />
              </div>
              <div>
                <Link
                  href={`/libraries/music/albums/${encodeURIComponent(alb.album.id)}`}
                  style={{ fontWeight: 600, fontSize: "14px", textDecoration: "none", color: "inherit" }}
                >
                  {alb.album.albumName}
                </Link>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{alb.album.artist}</div>
                <div style={{ fontSize: "11px", color: "var(--accent-color)", marginTop: "4px" }}>{alb.album.playCount} plays</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Tracks List */}
      {tab === "tracks" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                <th style={{ padding: "10px 16px" }}>Track</th>
                <th style={{ padding: "10px 16px" }}>Artist</th>
                <th style={{ padding: "10px 16px" }}>Plays</th>
                <th style={{ padding: "10px 16px" }}>Loved</th>
              </tr>
            </thead>
            <tbody>
              {filteredTracks.map((tr) => (
                <tr key={tr.track.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                    <Link href={`/libraries/music/tracks/${encodeURIComponent(tr.track.id)}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {tr.track.trackName}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{tr.track.artist}</td>
                  <td style={{ padding: "10px 16px" }}>{tr.track.playCount}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {tr.metadata?.loved === 1 ? <Heart size={14} fill="var(--accent-color)" color="var(--accent-color)" /> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Listening History Timeline */}
      {tab === "history" && (
        <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredHistory.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderRadius: "6px",
                background: "var(--bg-color)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Radio size={16} style={{ color: "var(--accent-color)" }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px" }}>{item.track}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {item.artist} {item.album ? `• ${item.album}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {new Date(item.playedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
