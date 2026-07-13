"use client";

import React, { useState } from "react";
import Link from "next/link";
import { type Microblog } from "@/db/schema";
import { setMicroblogStatus, deleteMicroblog, deleteMicroblogsBatch } from "./actions";
import { Search, Plus, Edit3, Trash2, Calendar, Tag } from "lucide-react";

interface MicroblogListProps {
  initialItems: Microblog[];
}

export function MicroblogList({ initialItems }: MicroblogListProps) {
  const [items, setItems] = useState<Microblog[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      item.contentMarkdown.toLowerCase().includes(search.toLowerCase()) ||
      item.slug.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = async (id: string, newStatus: any) => {
    await setMicroblogStatus(id, newStatus);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this microblog entry?")) return;
    await deleteMicroblog(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredItems.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected microblog posts?`)) {
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
        <h1 className="page-title">Microblog Posts ({filteredItems.length})</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="btn btn-danger"
              disabled={isDeleting}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Trash2 size={16} />
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
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1 }}>
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

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40px", paddingRight: 0 }}>
                <input
                  type="checkbox"
                  checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
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
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                  No microblog posts found.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
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
                      <Link
                        href={`/microblog/${item.id}`}
                        style={{ fontWeight: 600, textDecoration: "none" }}
                      >
                        {snippet || item.slug}
                      </Link>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        /{item.slug}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${item.status}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="hide-on-mobile" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="hide-on-mobile" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      {formatDate(item.publishedAt)}
                    </td>
                    <td className="hide-on-mobile" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
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
                        >
                          <Trash2 size={14} />
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
    </div>
  );
}
