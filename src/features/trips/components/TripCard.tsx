"use client";

import React from "react";
import Link from "next/link";
import { TripStatusBadge } from "./TripStatusBadge";
import { TripCover } from "./TripCover";
import { TripOverflowMenu } from "./TripOverflowMenu";
import type { TripOverviewItem, TripViewMode } from "../types";

interface TripCardProps {
  trip: TripOverviewItem;
  viewMode?: TripViewMode;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onEdit: (trip: TripOverviewItem) => void;
  onDuplicate: (id: string) => void;
  onDelete: (trip: TripOverviewItem) => void;
}

export function TripCard({
  trip,
  viewMode = "grid",
  onToggleFavorite,
  onEdit,
  onDuplicate,
  onDelete,
}: TripCardProps) {
  const isList = viewMode === "list";

  // Location display logic: first 3-4, then +N more
  const maxLocationsToShow = 3;
  const displayedLocations = trip.locationNames.slice(0, maxLocationsToShow);
  const remainingLocationsCount = Math.max(0, trip.locationNames.length - maxLocationsToShow);

  const tripHref = `/trips/${trip.slug}`;

  return (
    <article
      className={`trip-card ${isList ? "list-card" : ""}`}
      aria-labelledby={`trip-title-${trip.id}`}
    >
      <TripCover
        coverImageUrl={trip.coverImageUrl}
        fallbackTheme={trip.fallbackCoverTheme}
        durationDays={trip.duration}
        isFavorite={trip.favorite}
        onToggleFavorite={(e) => onToggleFavorite(trip.id, e)}
        title={trip.title}
      />

      <div className="trip-card-body">
        <div className="trip-card-top">
          <TripStatusBadge status={trip.status} />
        </div>

        <Link
          href={tripHref}
          id={`trip-title-${trip.id}`}
          className="trip-card-title-link"
        >
          {trip.displayTitle || trip.title}
        </Link>

        <div className="trip-card-date">{trip.dateRangeFormatted}</div>

        <div className="trip-meta-row">
          <span className="trip-meta-item">
            {trip.duration} {trip.duration === 1 ? "day" : "days"}
          </span>
          <span className="trip-meta-item">
            · {trip.placesCount} {trip.placesCount === 1 ? "place" : "places"}
          </span>
          <span className="trip-meta-item">
            · {trip.photosCount} {trip.photosCount === 1 ? "photo" : "photos"}
          </span>
          {trip.spendFormatted && (
            <span className="trip-meta-item">· {trip.spendFormatted}</span>
          )}
          {trip.distanceFormatted && (
            <span className="trip-meta-item">· {trip.distanceFormatted}</span>
          )}
        </div>

        {displayedLocations.length > 0 && (
          <div className="trip-location-pills">
            {displayedLocations.map((loc, idx) => (
              <span key={`${loc}-${idx}`} className="trip-location-pill">
                {loc}
              </span>
            ))}
            {remainingLocationsCount > 0 && (
              <span className="trip-more-pill">+{remainingLocationsCount} more</span>
            )}
          </div>
        )}

        <div className="trip-progress-block">
          <div className="trip-progress-head">
            <span>Itinerary</span>
            <span>
              {trip.itineraryPlannedDays}/{trip.itineraryTotalDays} days
            </span>
          </div>
          <div className="trip-progress-bar">
            <span
              className="trip-progress-fill"
              style={{ width: `${trip.itineraryProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="trip-card-footer">
        <Link href={tripHref} className="trip-open-btn">
          <span>Open Trip →</span>
        </Link>

        <TripOverflowMenu
          tripTitle={trip.title}
          onEdit={() => onEdit(trip)}
          onDuplicate={() => onDuplicate(trip.id)}
          onDelete={() => onDelete(trip)}
        />
      </div>
    </article>
  );
}
