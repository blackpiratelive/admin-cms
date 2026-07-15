"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { CombinedShow, PaginatedResult, ShowFilterOptions } from "../types";
import { getPaginatedShowsAction } from "../actions/shows";
import { ShowCard } from "./ShowCard";
import { getBrowserCache, setBrowserCache, clearBrowserCachePrefix } from "@/lib/client-cache";
import { Search, Filter, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface ShowsListProps {
  initialData: PaginatedResult<CombinedShow>;
  initialParams?: ShowFilterOptions;
}

export function ShowsList({ initialData, initialParams }: ShowsListProps) {
  const [items, setItems] = useState<CombinedShow[]>(initialData.items);
  const [totalItems, setTotalItems] = useState<number>(initialData.total);
  const [totalPages, setTotalPages] = useState<number>(initialData.totalPages);

  const [query, setQuery] = useState(initialParams?.query || "");
  const [status, setStatus] = useState<string>(initialParams?.status || "");
  const [sort, setSort] = useState<any>(initialParams?.sortBy || "title");
  const [favorite, setFavorite] = useState<boolean>(initialParams?.favorite || false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [isFetching, setIsFetching] = useState(false);
  const isInitialMount = useRef(true);

  const getCacheKey = useCallback(
    (q: string, st: string, s: string, fav: boolean, p: number, limit: number) =>
      `shows_list_${st}_${s}_${fav ? "1" : "0"}_${limit}_${p}_${q.trim()}`,
    []
  );

  const fetchServerData = useCallback(
    async (q: string, st: string, s: string, fav: boolean, p: number, limit: number) => {
      const cacheKey = getCacheKey(q, st, s, fav, p, limit);
      const cached = getBrowserCache<PaginatedResult<CombinedShow>>(cacheKey);

      if (cached) {
        setItems(cached.items);
        setTotalItems(cached.total);
        setTotalPages(cached.totalPages);
      }

      setIsFetching(!cached);

      try {
        const res = await getPaginatedShowsAction({
          query: q,
          status: st,
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
        console.error("Failed to fetch paginated shows:", err);
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
        setBrowserCache(getCacheKey("", "", "title", false, 1, 25), initialData);
      }
      return;
    }

    const timer = setTimeout(() => {
      fetchServerData(query, status, sort, favorite, currentPage, pageSize);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, status, sort, favorite, currentPage, pageSize, fetchServerData, getCacheKey, initialData]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value);
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
      {/* Header Info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <span>Showing {items.length} of {totalItems} TV Shows</span>
          {isFetching && <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-bar card library-filter-bar">
        <div style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", gap: "6px" }}>
          {isFetching ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
          ) : (
            <Search size={16} style={{ color: "var(--text-muted)" }} />
          )}
          <input
            type="text"
            placeholder="Search TV shows by title or notes..."
            value={query}
            onChange={handleQueryChange}
            className="search-input"
            style={{ width: "100%", fontSize: "13px" }}
          />
        </div>

        <select value={status} onChange={handleStatusChange} className="select-input" style={{ fontSize: "12px" }} disabled={isFetching}>
          <option value="">All Statuses</option>
          <option value="returning series">Returning Series</option>
          <option value="ended">Ended</option>
          <option value="canceled">Canceled</option>
        </select>

        <select value={sort} onChange={handleSortChange} className="select-input" style={{ fontSize: "12px" }} disabled={isFetching}>
          <option value="title">Sort by Title</option>
          <option value="year">Sort by Release Year</option>
          <option value="updated_at">Sort by Last Updated</option>
        </select>

        <select value={pageSize} onChange={handlePageSizeChange} className="select-input" style={{ fontSize: "12px" }} disabled={isFetching}>
          <option value={12}>12 per page</option>
          <option value={25}>25 per page (Default)</option>
          <option value={50}>50 per page</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
          <input type="checkbox" checked={favorite} onChange={handleFavoriteChange} disabled={isFetching} />
          <span>Favorites Only</span>
        </label>
      </div>

      {/* Shows Grid Container */}
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
            <h3>No TV shows matching current filters.</h3>
            <p style={{ fontSize: "13px" }}>Sync your Trakt account to import TV show watch history.</p>
          </div>
        ) : (
          <div
            className="library-cards-grid"
            style={{
              opacity: isFetching ? 0.4 : 1,
              transition: "opacity 0.2s ease",
              pointerEvents: isFetching ? "none" : "auto",
            }}
          >
            {items.map((showData) => (
              <ShowCard key={showData.show.traktId} showData={showData} />
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
