"use client";

import React from "react";
import type { TripFilterType } from "../types";

interface TripFilterChipsProps {
  activeFilter: TripFilterType;
  onChangeFilter: (filter: TripFilterType) => void;
  counts?: Partial<Record<TripFilterType, number>>;
}

export function TripFilterChips({
  activeFilter,
  onChangeFilter,
  counts,
}: TripFilterChipsProps) {
  const filters: Array<{ id: TripFilterType; label: string }> = [
    { id: "all", label: "All" },
    { id: "upcoming", label: "Upcoming" },
    { id: "ongoing", label: "Ongoing" },
    { id: "completed", label: "Completed" },
    { id: "favorites", label: "★ Favorites" },
  ];

  return (
    <nav className="trip-chips-wrap" aria-label="Trip status filters">
      {filters.map((f) => {
        const isActive = activeFilter === f.id;
        const count = counts?.[f.id];

        return (
          <button
            key={f.id}
            type="button"
            className={`trip-chip-btn ${isActive ? "active" : ""}`}
            onClick={() => onChangeFilter(f.id)}
            aria-pressed={isActive}
          >
            <span>{f.label}</span>
            {typeof count === "number" && (
              <span
                style={{
                  fontSize: "11px",
                  opacity: isActive ? 0.9 : 0.65,
                  marginLeft: "2px",
                }}
              >
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
