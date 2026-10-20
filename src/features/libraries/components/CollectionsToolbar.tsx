"use client";

import React, { useMemo, useState } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import {
  type CollectionKindFilter,
  type CollectionSort,
  type CollectionVisibilityFilter,
  type CollectionViewMode,
} from "../collection-helpers";
import type { CollectionOverview } from "../collection-types";

interface CollectionsToolbarProps {
  collections: CollectionOverview[];
  query: string;
  kind: CollectionKindFilter;
  visibility: CollectionVisibilityFilter;
  sort: CollectionSort;
  viewMode: CollectionViewMode;
  onQueryChange: (query: string) => void;
  onKindChange: (kind: CollectionKindFilter) => void;
  onVisibilityChange: (visibility: CollectionVisibilityFilter) => void;
  onSortChange: (sort: CollectionSort) => void;
  onViewModeChange: (viewMode: CollectionViewMode) => void;
}

export function CollectionsToolbar({
  collections,
  query,
  kind,
  visibility,
  sort,
  viewMode,
  onQueryChange,
  onKindChange,
  onVisibilityChange,
  onSortChange,
  onViewModeChange,
}: CollectionsToolbarProps) {
  const [focused, setFocused] = useState(false);

  const kindCounts = useMemo(() => {
    const counts = { all: collections.length, photo: 0, media: 0, mixed: 0 };
    for (const collection of collections) {
      if (collection.kind === "photo") counts.photo += 1;
      else if (collection.kind === "media") counts.media += 1;
      else if (collection.kind === "mixed") counts.mixed += 1;
    }
    return counts;
  }, [collections]);

  const chips: Array<{ id: CollectionKindFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: kindCounts.all },
    { id: "photo", label: "Photo", count: kindCounts.photo },
    { id: "media", label: "Media", count: kindCounts.media },
    { id: "mixed", label: "Mixed", count: kindCounts.mixed },
  ];

  return (
    <section className="collections-toolbar" aria-label="Collection search and display controls">
      <div className={`collections-search ${focused ? "is-focused" : ""}`}>
        <Search size={16} className="collections-search-icon" aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Search collections and descriptions…"
          aria-label="Search collections"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onQueryChange("");
          }}
        />
        {query && (
          <button
            type="button"
            className="collections-search-clear"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="collections-toolbar-controls">
        <select
          className="collections-select"
          value={visibility}
          onChange={(event) =>
            onVisibilityChange(event.target.value as CollectionVisibilityFilter)
          }
          aria-label="Filter by visibility"
        >
          <option value="all">All visibility</option>
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>

        <select
          className="collections-select"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as CollectionSort)}
          aria-label="Sort collections"
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
          <option value="items">Most items</option>
          <option value="views">Most viewed</option>
        </select>

        <div className="collections-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`collections-view-btn ${viewMode === "grid" ? "is-active" : ""}`}
            onClick={() => onViewModeChange("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            className={`collections-view-btn ${viewMode === "list" ? "is-active" : ""}`}
            onClick={() => onViewModeChange("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      <nav className="collections-chips" aria-label="Collection type filters">
        {chips.map((chip) => {
          const active = kind === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              className={`collections-chip ${active ? "is-active" : ""}`}
              onClick={() => onKindChange(chip.id)}
              aria-pressed={active}
            >
              {chip.label}
              <span className="collections-chip-count">{chip.count}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
