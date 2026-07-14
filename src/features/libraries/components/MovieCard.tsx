"use client";

import React from "react";
import { CombinedMovie } from "../types";
import { getTmdbImageUrl } from "../utils/images";
import { Heart, Star, Tag, Eye, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface MovieCardProps {
  movieData: CombinedMovie;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function MovieCard({ movieData, isSelected, onToggleSelect }: MovieCardProps) {
  const { movie, metadata } = movieData;

  const posterUrl = getTmdbImageUrl(movie.posterPath, "poster") || "https://placehold.co/300x450/1a1a1a/cccccc?text=No+Poster";

  let genres: string[] = [];
  try {
    genres = JSON.parse(movie.genres || "[]");
  } catch {}

  let tags: string[] = [];
  try {
    tags = JSON.parse(metadata?.tags || "[]");
  } catch {}

  return (
    <div
      className="card card-hover"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: isSelected ? "2px solid var(--accent-color)" : "1px solid var(--border-color)",
        padding: 0,
      }}
    >
      {/* Select Checkbox Overlay */}
      {onToggleSelect && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect();
          }}
          style={{
            position: "absolute",
            top: "8px",
            left: "8px",
            zIndex: 10,
            cursor: "pointer",
            background: "rgba(0,0,0,0.6)",
            borderRadius: "4px",
            padding: "2px",
          }}
        >
          <input type="checkbox" checked={!!isSelected} onChange={() => {}} style={{ cursor: "pointer" }} />
        </div>
      )}

      {/* Badges Overlay */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 10,
          display: "flex",
          gap: "4px",
        }}
      >
        {metadata?.favorite === 1 && (
          <span
            style={{
              background: "rgba(229, 9, 20, 0.9)",
              color: "#fff",
              padding: "4px 6px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Heart size={12} fill="currentColor" />
          </span>
        )}
        {metadata?.review && (
          <span
            style={{
              background: "rgba(0, 168, 225, 0.9)",
              color: "#fff",
              padding: "4px 6px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
            title="Reviewed"
          >
            <CheckCircle2 size={12} />
          </span>
        )}
      </div>

      <Link href={`/libraries/movies/${movie.traktId}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", background: "#111" }}>
          <img
            src={posterUrl}
            alt={movie.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>

        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {movie.title}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)" }}>
            <span>{movie.year || "Unknown"}</span>
            {movie.runtime ? <span>{movie.runtime} min</span> : null}
          </div>

          {/* Ratings */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
            {movie.rating && (
              <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "#f5c518", fontWeight: 600 }}>
                <Star size={12} fill="currentColor" /> {movie.rating.toFixed(1)}
              </span>
            )}
            {metadata?.personalRating && (
              <span style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--accent-color)", fontWeight: 600 }}>
                My Rating: ★ {metadata.personalRating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Genres & Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
            {genres.slice(0, 2).map((g) => (
              <span key={g} className="badge badge-secondary" style={{ fontSize: "10px", padding: "1px 5px" }}>
                {g}
              </span>
            ))}
            {tags.slice(0, 2).map((t) => (
              <span key={t} className="badge badge-accent" style={{ fontSize: "10px", padding: "1px 5px" }}>
                #{t}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
