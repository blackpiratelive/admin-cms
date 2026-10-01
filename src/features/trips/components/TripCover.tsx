"use client";

import React, { useState } from "react";

interface TripCoverProps {
  coverImageUrl?: string | null;
  fallbackTheme: "one" | "two" | "three" | "four";
  durationDays: number;
  isFavorite: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  title: string;
  eagerLoad?: boolean;
}

export function TripCover({
  coverImageUrl,
  fallbackTheme,
  durationDays,
  isFavorite,
  onToggleFavorite,
  title,
  eagerLoad = false,
}: TripCoverProps) {
  const [imgError, setImgError] = useState(false);

  const hasImage = Boolean(coverImageUrl && !imgError);
  const themeClass = fallbackTheme || "one";

  return (
    <div className={`trip-cover ${!hasImage ? `${themeClass} has-art` : ""}`}>
      {hasImage && (
        <img
          src={coverImageUrl!}
          alt={`Cover image for ${title}`}
          className="trip-cover-img"
          loading={eagerLoad ? "eager" : "lazy"}
          onError={() => setImgError(true)}
        />
      )}

      <div className="trip-cover-label">
        {durationDays} {durationDays === 1 ? "day" : "days"}
      </div>

      {onToggleFavorite && (
        <button
          type="button"
          className={`trip-fav-btn ${isFavorite ? "active" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(e);
          }}
          aria-label={isFavorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
          aria-pressed={isFavorite}
          title={isFavorite ? "Favorited" : "Favorite"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      )}
    </div>
  );
}
