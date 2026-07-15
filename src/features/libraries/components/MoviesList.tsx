"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CombinedMovie, PaginatedResult, MovieFilterOptions } from "../types";
import { getPaginatedMoviesAction } from "../actions/movies";
import { MovieCard } from "./MovieCard";
import { getBrowserCache, setBrowserCache, clearBrowserCachePrefix } from "@/lib/client-cache";
import { Search, Filter, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface MoviesListProps {
  initialData: PaginatedResult<CombinedMovie>;
  initialParams?: MovieFilterOptions;
}

export function MoviesList({ initialData, initialParams }: MoviesListProps) {
  const [items, setItems] = useState<CombinedMovie[]>(initialData.items);
  const [totalItems, setTotalItems] = useState<number>(initialData.total);
  const [totalPages, setTotalPages] = useState<number>(initialData.totalPages);

  const [query, setQuery] = useState(initialParams?.query || "");
  const [timeframe, setTimeframe] = useState<any>(initialParams?.timeframe || "all");
  const [reviewed, setReviewed] = useState<any>(initialParams?.reviewed || "all");
  const [sort, setSort] = useState<any>(initialParams?.sortBy || "watched_at");
  const [favorite, setFavorite] = useState<boolean>(initialParams?.favorite || false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [isFetching, setIsFetching] = useState(false);
  const isInitialMount = useRef(true);

  const getCacheKey = useCallback(
    (q: string, tf: string, rev: string, s: string, fav: boolean, p: number, limit: number) =>
      `movies_list_${tf}_${rev}_${s}_${fav ? "1" : "0"}_${limit}_${p}_${q.trim()}`,
    []
  );

  const fetchServerData = useCallback(
    async (q: string, tf: string, rev: string, s: string, fav: boolean, p: number, limit: number) => {
      const cacheKey = getCacheKey(q, tf, rev, s, fav, p, limit);
      const cached = getBrowserCache<PaginatedResult<CombinedMovie>>(cacheKey);

      if (cached) {
        setItems(cached.items);
        setTotalItems(cached.total);
        setTotalPages(cached.totalPages);
      }

      setIsFetching(!cached);

      try {
        const res = await getPaginatedMoviesAction({
          query: q,
          timeframe: tf as any,
          reviewed: rev as any,
          sortBy: s as any,
          favorite: fav,
          page: p,
          limit,
        });

        setItems(res.items);
        setTotalItems(res.total);
        setTotalPages(res.totalPages);
        setBrowserCache(cacheKey, res);
      } catch (err) {
        console.error("Failed to fetch paginated movies:", err);
      } finally {
        setIsFetching(false);
      }
    },
    [getCacheKey]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialData) {
        setBrowserCache(getCacheKey("", "all", "all", "watched_at", false, 1, 25), initialData);
      }
      return;
    }

    const timer = setTimeout(() => {
      fetchServerData(query, timeframe, reviewed, sort, favorite, currentPage, pageSize);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, timeframe, reviewed, sort, favorite, currentPage, pageSize, fetchServerData, getCacheKey, initialData]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleTimeframeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeframe(e.target.value);
    setCurrentPage(1);
  };

  const handleReviewedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setReviewed(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setCurrentPage(1);
  };

  const handleFavoriteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFavorite(e.target.checked);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Count Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <span>Showing {items.length} of {totalItems} Movies</span>
          {isFetching && <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />}
        </div>
      </div>

      {/* Server Filter Toolbar */}
      <div className="filter-bar card" style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", gap: "6px" }}>
          {isFetching ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
          ) : (
            <Search size={16} style={{ color: "var(--text-muted)" }} />
          )}
          <input
            type="text"
            placeholder="Search movies by title, notes, or reviews..."
            value={query}
            onChange={handleQueryChange}
            className="search-input"
            style={{ width: "100%", fontSize: "13px" }}
          />
        </div>

        <select value={timeframe} onChange={handleTimeframeChange} className="select-input" style={{ width: "auto", fontSize: "12px" }} disabled={isFetching}>
          <option value="all">All Timeframes</option>
          <option value="recently_watched">Recently Watched</option>
          <option value="this_year">Watched This Year</option>
          <option value="last_month">Watched Last Month</option>
        </select>

        <select value={reviewed} onChange={handleReviewedChange} className="select-input" style={{ width: "auto", fontSize: "12px" }} disabled={isFetching}>
          <option value="all">All Review States</option>
          <option value="reviewed">Reviewed</option>
          <option value="unreviewed">Unreviewed</option>
        </select>

        <select value={sort} onChange={handleSortChange} className="select-input" style={{ width: "auto", fontSize: "12px" }} disabled={isFetching}>
          <option value="watched_at">Sort by Watched Date</option>
          <option value="title">Sort by Title</option>
          <option value="year">Sort by Release Year</option>
          <option value="rating">Sort by Provider Rating</option>
          <option value="personal_rating">Sort by Personal Rating</option>
        </select>

        <select value={pageSize} onChange={handlePageSizeChange} className="select-input" style={{ width: "auto", fontSize: "12px" }} disabled={isFetching}>
          <option value={12}>12 per page</option>
          <option value={25}>25 per page (Default)</option>
          <option value={50}>50 per page</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
          <input type="checkbox" checked={favorite} onChange={handleFavoriteChange} disabled={isFetching} />
          <span>Favorites Only</span>
        </label>
      </div>

      {/* Movies Grid Container */}
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

        {items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <h3>No movies matching current filters.</h3>
            <p style={{ fontSize: "13px" }}>Try adjusting your search filters or sync your Trakt account in Sync Center.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "20px",
              opacity: isFetching ? 0.4 : 1,
              transition: "opacity 0.2s ease",
              pointerEvents: isFetching ? "none" : "auto",
            }}
          >
            {items.map((movieData) => (
              <MovieCard key={movieData.movie.traktId} movieData={movieData} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Footer Controls */}
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
