"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CombinedArtist, CombinedAlbum, CombinedTrack, PaginatedResult } from "../types";
import { LastfmScrobbleRecord } from "@/db/schema";
import {
  getPaginatedArtistsAction,
  getPaginatedAlbumsAction,
  getPaginatedTracksAction,
  getPaginatedHistoryAction,
} from "../actions/music";
import { CoverImage } from "@/components/CoverImage";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";
import {
  Music,
  Disc,
  Radio,
  Clock,
  Heart,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Link from "next/link";

interface MusicTabsProps {
  initialArtists: PaginatedResult<CombinedArtist>;
  initialAlbums: PaginatedResult<CombinedAlbum>;
  initialTracks: PaginatedResult<CombinedTrack>;
  initialHistory: PaginatedResult<LastfmScrobbleRecord>;
  activeTab: "artists" | "albums" | "tracks" | "history";
}

export function MusicTabs({
  initialArtists,
  initialAlbums,
  initialTracks,
  initialHistory,
  activeTab: initialTab,
}: MusicTabsProps) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isFetching, setIsFetching] = useState(false);

  const [artistsRes, setArtistsRes] = useState<PaginatedResult<CombinedArtist>>(initialArtists);
  const [albumsRes, setAlbumsRes] = useState<PaginatedResult<CombinedAlbum>>(initialAlbums);
  const [tracksRes, setTracksRes] = useState<PaginatedResult<CombinedTrack>>(initialTracks);
  const [historyRes, setHistoryRes] = useState<PaginatedResult<LastfmScrobbleRecord>>(initialHistory);

  const isInitialMount = useRef(true);

  const getCacheKey = useCallback((tb: string, q: string, fav: boolean, p: number, limit: number) => {
    return `music_tab_${tb}_${q.trim()}_${fav ? "1" : "0"}_${p}_${limit}`;
  }, []);

  const fetchTabServerData = useCallback(
    async (tb: string, q: string, fav: boolean, p: number, limit: number) => {
      const cacheKey = getCacheKey(tb, q, fav, p, limit);
      const cached = getBrowserCache<any>(cacheKey);

      if (cached) {
        if (tb === "artists") setArtistsRes(cached);
        else if (tb === "albums") setAlbumsRes(cached);
        else if (tb === "tracks") setTracksRes(cached);
        else if (tb === "history") setHistoryRes(cached);
      }

      setIsFetching(!cached);

      try {
        if (tb === "artists") {
          const res = await getPaginatedArtistsAction({ query: q, favorite: fav, page: p, limit });
          setArtistsRes(res);
          setBrowserCache(cacheKey, res);
        } else if (tb === "albums") {
          const res = await getPaginatedAlbumsAction({ query: q, favorite: fav, page: p, limit });
          setAlbumsRes(res);
          setBrowserCache(cacheKey, res);
        } else if (tb === "tracks") {
          const res = await getPaginatedTracksAction({ query: q, favorite: fav, page: p, limit });
          setTracksRes(res);
          setBrowserCache(cacheKey, res);
        } else if (tb === "history") {
          const res = await getPaginatedHistoryAction({ query: q, page: p, limit });
          setHistoryRes(res);
          setBrowserCache(cacheKey, res);
        }
      } catch (err) {
        console.error("Failed to fetch tab data:", err);
      } finally {
        setIsFetching(false);
      }
    },
    [getCacheKey]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchTabServerData(tab, query, favoriteOnly, currentPage, pageSize);
    }, 300);

    return () => clearTimeout(timer);
  }, [tab, query, favoriteOnly, currentPage, pageSize, fetchTabServerData]);

  const handleTabSwitch = (newTab: "artists" | "albums" | "tracks" | "history") => {
    setTab(newTab);
    setCurrentPage(1);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleFavoriteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFavoriteOnly(e.target.checked);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const getCurrentTotal = () => {
    if (tab === "artists") return artistsRes.total;
    if (tab === "albums") return albumsRes.total;
    if (tab === "tracks") return tracksRes.total;
    return historyRes.total;
  };

  const getCurrentTotalPages = () => {
    if (tab === "artists") return artistsRes.totalPages;
    if (tab === "albums") return albumsRes.totalPages;
    if (tab === "tracks") return tracksRes.totalPages;
    return historyRes.totalPages;
  };

  const totalItems = getCurrentTotal();
  const totalPages = getCurrentTotalPages();
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Controls & Filter Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px", background: "var(--bg-card)", padding: "4px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
          <button
            className={`btn btn-sm ${tab === "artists" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTabSwitch("artists")}
            style={{ border: "none" }}
            disabled={isFetching}
          >
            <Music size={14} /> Artists ({artistsRes.total})
          </button>

          <button
            className={`btn btn-sm ${tab === "albums" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTabSwitch("albums")}
            style={{ border: "none" }}
            disabled={isFetching}
          >
            <Disc size={14} /> Albums ({albumsRes.total})
          </button>

          <button
            className={`btn btn-sm ${tab === "tracks" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTabSwitch("tracks")}
            style={{ border: "none" }}
            disabled={isFetching}
          >
            <Radio size={14} /> Tracks ({tracksRes.total})
          </button>

          <button
            className={`btn btn-sm ${tab === "history" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTabSwitch("history")}
            style={{ border: "none" }}
            disabled={isFetching}
          >
            <Clock size={14} /> History ({historyRes.total})
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: "220px", display: "flex", alignItems: "center" }}>
            {isFetching ? (
              <Loader2 size={14} className="animate-spin" style={{ position: "absolute", left: "10px", color: "var(--accent)" }} />
            ) : (
              <Search size={14} style={{ position: "absolute", left: "10px", color: "var(--text-muted)" }} />
            )}
            <input
              type="text"
              className="text-input"
              placeholder={`Search ${tab}...`}
              value={query}
              onChange={handleQueryChange}
              style={{ paddingLeft: "32px", fontSize: "12px", width: "100%" }}
            />
          </div>

          <select value={pageSize} onChange={handlePageSizeChange} className="select-input" style={{ width: "auto", fontSize: "12px" }} disabled={isFetching}>
            <option value={12}>12 per page</option>
            <option value={25}>25 per page (Default)</option>
            <option value={50}>50 per page</option>
          </select>

          {tab !== "history" && (
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
              <input type="checkbox" checked={favoriteOnly} onChange={handleFavoriteChange} disabled={isFetching} />
              <Heart size={14} fill={favoriteOnly ? "var(--accent-color)" : "none"} color={favoriteOnly ? "var(--accent-color)" : "currentColor"} />
              <span>Favorites Only</span>
            </label>
          )}
        </div>
      </div>

      {/* Content Render Container */}
      <div style={{ position: "relative", minHeight: "200px" }}>
        {isFetching && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              backgroundColor: "var(--accent)",
              zIndex: 10,
              borderRadius: "2px",
            }}
          />
        )}

        <div
          style={{
            opacity: isFetching ? 0.4 : 1,
            transition: "opacity 0.2s ease",
            pointerEvents: isFetching ? "none" : "auto",
          }}
        >
          {/* 1. Artists Tab */}
          {tab === "artists" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              {artistsRes.items.length === 0 ? (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                  No artists matching filters.
                </div>
              ) : (
                artistsRes.items.map((a) => (
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
                        {a.artist.artistName[0]?.toUpperCase() || "A"}
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
                ))
              )}
            </div>
          )}

          {/* 2. Albums Tab */}
          {tab === "albums" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              {albumsRes.items.length === 0 ? (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                  No albums matching filters.
                </div>
              ) : (
                albumsRes.items.map((alb) => (
                  <div key={alb.album.id} className="card card-hover" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <CoverImage
                      src={`https://placehold.co/300x300/1a1a1a/cccccc?text=${encodeURIComponent(alb.album.albumName.slice(0, 15))}`}
                      alt={alb.album.albumName}
                      aspectRatio="1/1"
                      style={{ borderRadius: "6px" }}
                    />
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
                ))
              )}
            </div>
          )}

          {/* 3. Tracks Tab */}
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
                  {tracksRes.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        No tracks matching filters.
                      </td>
                    </tr>
                  ) : (
                    tracksRes.items.map((tr) => (
                      <tr key={tr.track.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: "10px 16px", fontWeight: 600 }}>
                          <Link href={`/libraries/music/tracks/${encodeURIComponent(tr.track.id)}`} style={{ textDecoration: "none", color: "inherit" }}>
                            {tr.track.trackName}
                          </Link>
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{tr.track.artist}</td>
                        <td style={{ padding: "10px 16px" }}>{tr.track.playCount}</td>
                        <td style={{ padding: "10px 16px" }}>
                          {tr.metadata?.loved === 1 || tr.metadata?.favorite === 1 ? (
                            <Heart size={14} fill="var(--accent-color)" color="var(--accent-color)" />
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Listening History Tab */}
          {tab === "history" && (
            <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {historyRes.items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  No listening history entries found.
                </div>
              ) : (
                historyRes.items.map((item) => (
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
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Server Pagination Footer Controls */}
      {totalItems > 0 && (
        <div
          className="pagination-controls"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 4px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span>
              Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of <strong>{totalItems}</strong> entries
            </span>
            {isFetching && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--accent)" }}>
                <Loader2 size={12} className="animate-spin" /> Fetching...
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1 || isFetching}
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isFetching}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>

            <span style={{ padding: "0 8px", fontWeight: 500 }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isFetching}
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages || isFetching}
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
