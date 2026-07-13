"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { type Microblog } from "@/db/schema";
import { setMicroblogStatus, deleteMicroblog, deleteMicroblogsBatch } from "./actions";
import { Search, Plus, Edit3, Trash2, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";

interface MicroblogListProps {
  initialItems: Microblog[];
}

export function hasImages(item: Microblog): boolean {
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

export function MicroblogList({ initialItems }: MicroblogListProps) {
  const [items, setItems] = useState<Microblog[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Pagination states (default 50 per page, configurable)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter items based on status and search query
  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      item.contentMarkdown.toLowerCase().includes(search.toLowerCase()) ||
      item.slug.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Reset page to 1 when filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  // Calculate pagination boundaries
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const isAllCurrentPageSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((item) => selectedIds.includes(item.id));

  const handleStatusChange = async (id: string, newStatus: any) => {
    setUpdatingStatusId(id);
    try {
      await setMicroblogStatus(id, newStatus);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this microblog entry?")) return;
    setDeletingId(id);
    try {
      await deleteMicroblog(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const pageIds = paginatedItems.map((item) => item.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(paginatedItems.map((item) => item.id));
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
        setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
        setSelectedIds([]);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="page-header">
        <h1 className="page-title">Microblog Posts ({totalItems})</h1>
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
            onChange={(e) => setSearch(e.target.value)}
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
            onChange={(e) => setStatusFilter(e.target.value)}
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
            onChange={(e) => setPageSize(Number(e.target.value))}
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
            {paginatedItems.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}
                >
                  No microblog posts found.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
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
            Showing <strong>{startIndex + 1}</strong> to <strong>{endIndex}</strong> of{" "}
            <strong>{totalItems}</strong> entries
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              title="Previous Page"
            >
              <ChevronLeft size={14} />
              <span>Prev</span>
            </button>

            <span style={{ padding: "0 8px", fontWeight: 500 }}>
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
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

