"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { TripOverviewItem } from "../types";

interface FeaturedTripProps {
  trip: TripOverviewItem;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export function FeaturedTrip({ trip, onToggleFavorite }: FeaturedTripProps) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(trip.coverImageUrl && !imgError);

  const tripHref = `/trips/${trip.slug}`;

  return (
    <section className="trip-featured" aria-label="Featured trip">
      <div className="trip-featured-grid">
        <div className="trip-hero-art">
          {hasImage && (
            <img
              src={trip.coverImageUrl!}
              alt={`Cover for featured trip ${trip.title}`}
              className="trip-hero-img"
              loading="eager"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        <div className="trip-hero-copy">
          <div className="trip-eyebrow">Featured trip</div>

          <h2 className="trip-hero-title">
            <Link
              href={tripHref}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {trip.displayTitle || trip.title}
            </Link>
          </h2>

          <div className="trip-hero-date">{trip.dateRangeFormatted}</div>

          <div className="trip-hero-stats">
            <div className="trip-hero-stat">
              <strong>{trip.duration}</strong> {trip.duration === 1 ? "day" : "days"}
            </div>
            <div className="trip-hero-stat">
              <strong>{trip.placesCount}</strong> {trip.placesCount === 1 ? "place" : "places"}
            </div>
            <div className="trip-hero-stat">
              <strong>{trip.photosCount}</strong> {trip.photosCount === 1 ? "photo" : "photos"}
            </div>
            {trip.spendFormatted && (
              <div className="trip-hero-stat">
                <strong>{trip.spendFormatted}</strong> spend
              </div>
            )}
            {trip.distanceFormatted && (
              <div className="trip-hero-stat">
                <strong>{trip.distanceFormatted}</strong>
              </div>
            )}
          </div>

          <div className="trip-hero-actions">
            <Link href={tripHref} className="trip-primary-btn" style={{ textDecoration: "none" }}>
              <span>Open trip →</span>
            </Link>

            <button
              type="button"
              className="trip-ghost-btn"
              onClick={(e) => onToggleFavorite(trip.id, e)}
              aria-label={trip.favorite ? "Favorited trip" : "Add to favorites"}
            >
              {trip.favorite ? "★ Favorited" : "☆ Favorite"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
