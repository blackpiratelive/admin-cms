"use client";

import React, { useRef } from "react";
import { Search, X, LayoutGrid, List } from "lucide-react";
import type { TripSortType, TripViewMode } from "../types";

interface TripsToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortValue: TripSortType;
  onSortChange: (sort: TripSortType) => void;
  viewMode: TripViewMode;
  onViewModeChange: (mode: TripViewMode) => void;
}

export function TripsToolbar({
  searchQuery,
  onSearchChange,
  sortValue,
  onSortChange,
  viewMode,
  onViewModeChange,
}: TripsToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onSearchChange("");
      inputRef.current?.blur();
    }
  };

  return (
    <section className="trip-toolbar" aria-label="Trip search and display controls">
      <div className="trip-search-box">
        <span className="trip-search-icon" aria-hidden="true">
          <Search size={16} />
        </span>

        <input
          ref={inputRef}
          type="text"
          className="trip-search-input"
          placeholder="Search trips, places, tags…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search trips, places, and tags"
        />

        {searchQuery && (
          <button
            type="button"
            className="trip-search-clear"
            onClick={() => {
              onSearchChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <select
        className="trip-control-select"
        value={sortValue}
        onChange={(e) => onSortChange(e.target.value as TripSortType)}
        aria-label="Sort trips"
      >
        <option value="recent">Sort: Recent</option>
        <option value="oldest">Sort: Oldest</option>
        <option value="duration">Sort: Duration</option>
        <option value="title">Sort: Title</option>
      </select>

      <div className="trip-view-toggle" role="group" aria-label="View toggle">
        <button
          type="button"
          className={`trip-view-btn ${viewMode === "grid" ? "active" : ""}`}
          onClick={() => onViewModeChange("grid")}
          aria-label="Grid view"
          title="Grid view"
        >
          <LayoutGrid size={16} />
        </button>
        <button
          type="button"
          className={`trip-view-btn ${viewMode === "list" ? "active" : ""}`}
          onClick={() => onViewModeChange("list")}
          aria-label="List view"
          title="List view"
        >
          <List size={16} />
        </button>
      </div>
    </section>
  );
}
