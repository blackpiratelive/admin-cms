"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  setMicroblogStatus,
  deleteMicroblog,
  deleteMicroblogsBatch,
  getMicroblogs,
  type MicroblogListItem,
  type MicroblogFetchResult,
} from "./actions";
import { Search, Plus, Edit3, Trash2, Globe, FileEdit, Clock, Archive, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface MicroblogListProps {
  initialData?: MicroblogFetchResult;
  initialItems?: MicroblogListItem[];
}

export function hasImages(item: { coverImageUrl?: string | null; images?: string | null }): boolean {
  if (item.coverImageUrl && item.coverImageUrl.trim() !== "") {
    return true;
  }
  if (item.images) {
    try {
      const parsed = JSON.parse(item.images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return true;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  return false;
}

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  let Icon = FileEdit;
  if (status === "published") Icon = Globe;
  else if (status === "scheduled") Icon = Clock;
  else if (status === "archived") Icon = Archive;

  return (
    <span
      className={`status-badge status-${status}`}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
      }}
    >
      <Icon size={16} />
    </span>
  );
}

export function MicroblogList({ initialData, initialItems }: MicroblogListProps) {
  const defaultItems = initialData?.items ?? initialItems ?? [];
  const defaultTotal = initialData?.total ?? defaultItems.length;
  const defaultTotalPages = initialData?.totalPages ?? Math.max(1, Math.ceil(defaultTotal / 50));

  const [items, setItems] = useState<MicroblogListItem[]>(defaultItems);
  const [totalItems, setTotalItems] = useState<number>(defaultTotal);
  const [totalPages, setTotalPages] = useState<number>(defaultTotalPages);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [isFetching, setIsFetching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const isInitialMount = useRef(true);

  const fetchServerData = useCallback(async (
    s: string,
    st: string,
    p: number,
    limit: number
  ) => {
    setIsFetching(true);
    try {
      const res = await getMicroblogs({
        search: s,
        status: st,
        page: p,
        limit,
      });
      setItems(res.items);
      setTotalItems(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error("Failed to fetch server microblogs:", err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      fetchServerData(search, statusFilter, currentPage, pageSize);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, statusFilter, currentPage, pageSize, fetchServerData]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const isAllCurrentPageSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const handleStatusChange = async (id: string, newStatus: any) => {
    setUpdatingStatusId(id);
    try {
      await setMicroblogStatus(id, newStatus);
      fetchServerData(search, statusFilter, currentPage, pageSize);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this microblog entry?")) return;
    setDeletingId(id);
    try {
      await deleteMicroblog(id);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      fetchServerData(search, statusFilter, currentPage, pageSize);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = items.map((item) => item.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(items.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete the ${selectedIds.length} selected microblog posts?`
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      const res = await deleteMicroblogsBatch(selectedIds);
      if (res.success) {
        setSelectedIds([]);
        fetchServerData(search, statusFilter, currentPage, pageSize);
      } else {
        alert(res.error || "Failed to delete selected posts.");
      }
    } catch (err) {
      alert("An error occurred during bulk deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="page-header">
        <h1 className="page-title" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <span>Microblog Posts ({totalItems})</span>
          {isFetching && <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />}
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn btn-danger"
              disabled={isDeleting}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}
          <Link href="/microblog/new" className="btn btn-primary">
            <Plus size={16} />
            <span>New Microblog</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="filter-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "200px" }}>
          {isFetching ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
          ) : (
            <Search size={16} style={{ color: "var(--text-muted)" }} />
          )}
          <input
            type="text"
            placeholder="Search microblog posts by content or slug..."
            value={search}
            onChange={handleSearchChange}
            className="search-input"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="select-input"
            disabled={isFetching}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            Per page:
          </label>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="select-input"
            disabled={isFetching}
            aria-label="Items per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50 (Default)</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-container" style={{ position: "relative" }}>
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
              opacity: 0.8,
              borderRadius: "2px 2px 0 0",
            }}
          />
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40px", paddingRight: 0 }}>
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={handleSelectAll}
                  disabled={isFetching}
                />
              </th>
              <th>Snippet / Slug</th>
              <th style={{ width: "60px", textAlign: "center" }}>Status</th>
              <th className="hide-on-mobile">Published</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ opacity: isFetching ? 0.4 : 1, transition: "opacity 0.2s ease", pointerEvents: isFetching ? "none" : "auto" }}>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}
                >
                  {isFetching ? "Loading microblog posts..." : "No microblog posts found."}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const snippet =
                  item.contentMarkdown.length > 60
                    ? item.contentMarkdown.slice(0, 60) + "..."
                    : item.contentMarkdown;

                return (
                  <tr key={item.id}>
                    <td style={{ width: "40px", paddingRight: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleSelectRow(item.id)}
                      />
                    </td>
                    <td>
                      <div>
                        <Link
                          href={`/microblog/${item.id}`}
                          style={{ fontWeight: 600, textDecoration: "none" }}
                        >
                          {snippet || item.slug}
                        </Link>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        /{item.slug}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td
                      className="hide-on-mobile"
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      {formatDate(item.publishedAt)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <Link href={`/microblog/${item.id}`} className="btn btn-sm" title="Edit">
                          <Edit3 size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-sm btn-danger"
                          title="Delete"
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls Footer */}
      {totalItems > 0 && (
        <div
          className="pagination-controls"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 4px",
            fontSize: "13px",
            color: "var(--text-secondary)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <span>
              Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{" "}
              <strong>{totalItems}</strong> entries
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

            <span style={{ padding: "0 8px", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span>Page {currentPage} of {totalPages}</span>
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

