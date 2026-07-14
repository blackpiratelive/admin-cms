"use client";

import React, { useState, useEffect } from "react";
import { Search, Film, Tv, Music, Disc, Radio, X } from "lucide-react";
import { globalSearchAction } from "../actions/search";
import { GlobalSearchResult } from "../types";
import { getTmdbImageUrl } from "../utils/images";
import Link from "next/link";

export function GlobalSearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearchAction(query);
        setResults(res);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults =
    (results?.movies.length || 0) +
    (results?.shows.length || 0) +
    (results?.artists.length || 0) +
    (results?.albums.length || 0) +
    (results?.tracks.length || 0);

  return (
    <div className="modal-overlay" style={{ zIndex: 99999 }}>
      <div
        className="modal-content"
        style={{
          width: "680px",
          maxWidth: "92vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
          borderRadius: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px",
            borderBottom: "1px solid var(--border-color)",
            gap: "10px",
          }}
        >
          <Search size={18} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            className="text-input"
            placeholder="Search Movies, TV Shows, Artists, Albums, Tracks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: "15px",
              outline: "none",
              boxShadow: "none",
            }}
          />
          <button className="btn btn-sm btn-icon" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {loading && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Searching library...
            </div>
          )}

          {!loading && results && totalResults === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No items matching "{query}"
            </div>
          )}

          {!loading && results && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Movies */}
              {results.movies.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                    <Film size={14} /> MOVIES
                  </div>
                  {results.movies.map((m) => (
                    <Link
                      key={m.movie.traktId}
                      href={`/libraries/movies/${m.movie.traktId}`}
                      onClick={() => setIsOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        textDecoration: "none",
                        color: "inherit",
                        marginBottom: "4px",
                        background: "var(--bg-card)",
                      }}
                    >
                      <img
                        src={getTmdbImageUrl(m.movie.posterPath, "poster") || "https://placehold.co/40x60/1a1a1a/cccccc?text=Film"}
                        alt={m.movie.title}
                        style={{ width: "32px", height: "48px", objectFit: "cover", borderRadius: "3px" }}
                      />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{m.movie.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {m.movie.year || "Unknown"} {m.movie.rating ? `• ★ ${m.movie.rating.toFixed(1)}` : ""}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* TV Shows */}
              {results.shows.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                    <Tv size={14} /> TV SHOWS
                  </div>
                  {results.shows.map((s) => (
                    <Link
                      key={s.show.traktId}
                      href={`/libraries/shows/${s.show.traktId}`}
                      onClick={() => setIsOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        textDecoration: "none",
                        color: "inherit",
                        marginBottom: "4px",
                        background: "var(--bg-card)",
                      }}
                    >
                      <img
                        src={getTmdbImageUrl(s.show.posterPath, "poster") || "https://placehold.co/40x60/1a1a1a/cccccc?text=TV"}
                        alt={s.show.title}
                        style={{ width: "32px", height: "48px", objectFit: "cover", borderRadius: "3px" }}
                      />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{s.show.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {s.show.year || "Unknown"} • {s.show.status || "Ongoing"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Music Artists */}
              {results.artists.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                    <Music size={14} /> ARTISTS
                  </div>
                  {results.artists.map((a) => (
                    <Link
                      key={a.artist.artistName}
                      href={`/libraries/music/artists/${encodeURIComponent(a.artist.artistName)}`}
                      onClick={() => setIsOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        textDecoration: "none",
                        color: "inherit",
                        marginBottom: "4px",
                        background: "var(--bg-card)",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "var(--accent-color)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "14px",
                        }}
                      >
                        {a.artist.artistName[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{a.artist.artistName}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {a.artist.playCount} plays
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Albums */}
              {results.albums.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                    <Disc size={14} /> ALBUMS
                  </div>
                  {results.albums.map((alb) => (
                    <Link
                      key={alb.album.id}
                      href={`/libraries/music/albums/${encodeURIComponent(alb.album.id)}`}
                      onClick={() => setIsOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        textDecoration: "none",
                        color: "inherit",
                        marginBottom: "4px",
                        background: "var(--bg-card)",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "4px",
                          background: "var(--border-color)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Disc size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{alb.album.albumName}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {alb.album.artist} • {alb.album.playCount} plays
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Tracks */}
              {results.tracks.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" }}>
                    <Radio size={14} /> TRACKS
                  </div>
                  {results.tracks.map((tr) => (
                    <Link
                      key={tr.track.id}
                      href={`/libraries/music/tracks/${encodeURIComponent(tr.track.id)}`}
                      onClick={() => setIsOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 10px",
                        borderRadius: "4px",
                        textDecoration: "none",
                        color: "inherit",
                        marginBottom: "4px",
                        background: "var(--bg-card)",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "4px",
                          background: "var(--border-color)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Radio size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600 }}>{tr.track.trackName}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {tr.track.artist} • {tr.track.playCount} plays
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-color)",
            fontSize: "12px",
            color: "var(--text-muted)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Press ESC to close</span>
          <span>Press Ctrl + K anytime</span>
        </div>
      </div>
    </div>
  );
}
