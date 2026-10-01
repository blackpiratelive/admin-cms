"use client";

import React from "react";
import { Compass, SearchX, Plus } from "lucide-react";

interface TripEmptyStateProps {
  isFiltered: boolean;
  onClearFilters?: () => void;
  onCreateTrip?: () => void;
}

export function TripEmptyState({
  isFiltered,
  onClearFilters,
  onCreateTrip,
}: TripEmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="trip-empty-box" role="status">
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 102, 0, 0.1)",
            color: "var(--accent, #ff6600)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 14px",
          }}
        >
          <SearchX size={22} />
        </div>

        <strong className="trip-empty-title">No trips found</strong>
        <p className="trip-empty-desc">
          Try a different search term or select another status filter.
        </p>

        {onClearFilters && (
          <button
            type="button"
            className="trip-ghost-btn"
            onClick={onClearFilters}
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="trip-empty-box" role="status">
      <div
        style={{
          width: "54px",
          height: "54px",
          borderRadius: "50%",
          backgroundColor: "rgba(255, 102, 0, 0.12)",
          color: "var(--accent, #ff6600)",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 16px",
        }}
      >
        <Compass size={26} />
      </div>

      <strong className="trip-empty-title">Start documenting a journey</strong>
      <p className="trip-empty-desc">
        Create a trip, add your dates, and build your day-by-day itinerary as you travel.
      </p>

      {onCreateTrip && (
        <button
          type="button"
          className="trip-primary-btn"
          onClick={onCreateTrip}
        >
          <Plus size={16} />
          <span>Create your first trip</span>
        </button>
      )}
    </div>
  );
}
