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
import { Search, Plus, Edit3, Trash2, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

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
          <Search size={16} style={{ color: "var(--text-muted)" }} />
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
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40px", paddingRight: 0 }}>
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Snippet / Slug</th>
              <th>Status</th>
              <th className="hide-on-mobile">Created</th>
              <th className="hide-on-mobile">Published</th>
              <th className="hide-on-mobile">Updated</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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

                const postHasImages = hasImages(item);

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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Link
                          href={`/microblog/${item.id}`}
                          style={{ fontWeight: 600, textDecoration: "none" }}
                        >
                          {snippet || item.slug}
                        </Link>
                        {postHasImages && (
                          <span
                            title="Has image attachments"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              color: "var(--accent)",
                              lineHeight: 1,
                            }}
                          >
                            <ImageIcon size={14} />
                          </span>
                        )}
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
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td
                      className="hide-on-mobile"
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      {formatDate(item.createdAt)}
                    </td>
                    <td
                      className="hide-on-mobile"
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      {formatDate(item.publishedAt)}
                    </td>
                    <td
                      className="hide-on-mobile"
                      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
                    >
                      {formatDate(item.updatedAt)}
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
          <div>
            Showing <strong>{startIndex}</strong> to <strong>{endIndex}</strong> of{" "}
            <strong>{totalItems}</strong> entries
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

