"use client";

import React from "react";
import { CombinedShow } from "../types";
import { getTmdbImageUrl } from "../utils/images";
import { Heart, Star, Tv, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { CoverImage } from "@/components/CoverImage";

interface ShowCardProps {
  showData: CombinedShow;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function ShowCard({ showData, isSelected, onToggleSelect }: ShowCardProps) {
  const { show, metadata, episodes } = showData;

  const posterUrl = getTmdbImageUrl(show.posterPath, "poster") || "https://placehold.co/300x450/1a1a1a/cccccc?text=No+Poster";

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

      <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 10, display: "flex", gap: "4px" }}>
        {metadata?.favorite === 1 && (
          <span style={{ background: "rgba(229, 9, 20, 0.9)", color: "#fff", padding: "4px 6px", borderRadius: "4px" }}>
            <Heart size={12} fill="currentColor" />
          </span>
        )}
      </div>

      <Link href={`/libraries/shows/${show.traktId}`} style={{ textDecoration: "none", color: "inherit" }}>
        <CoverImage src={posterUrl} alt={show.title} />

        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {show.title}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)" }}>
            <span>{show.year || "N/A"}</span>
            <span className="badge badge-secondary">{show.status || "Ongoing"}</span>
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            <Tv size={12} /> {episodes.length} episodes watched
          </div>

          {metadata?.personalRating && (
            <div style={{ fontSize: "12px", color: "var(--accent-color)", fontWeight: 600 }}>
              My Rating: ★ {metadata.personalRating.toFixed(1)}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
