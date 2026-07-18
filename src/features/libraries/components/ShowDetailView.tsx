"use client";

import React, { useState } from "react";
import { CombinedShow } from "../types";
import { getTmdbImageUrl } from "../utils/images";
import { updateShowMetadataAction } from "../actions/shows";
import { addItemToCollectionAction, removeItemFromCollectionAction } from "../actions/collections";
import { notify } from "@/lib/notifications";
import { CollectionRecord } from "@/db/schema";
import { Heart, Tv, ArrowLeft, ExternalLink, FolderPlus, Save, Check } from "lucide-react";
import Link from "next/link";

interface ShowDetailViewProps {
  showData: CombinedShow;
  allCollections: CollectionRecord[];
}

export function ShowDetailView({ showData, allCollections }: ShowDetailViewProps) {
  const { show, metadata, episodes, collections: currentCollections } = showData;

  const [favorite, setFavorite] = useState(metadata?.favorite === 1);
  const [personalRating, setPersonalRating] = useState<number | "">(metadata?.personalRating ?? "");
  const [review, setReview] = useState(metadata?.review || "");
  const [notes, setNotes] = useState(metadata?.notes || "");
  const [tagsInput, setTagsInput] = useState(() => {
    try {
      return JSON.parse(metadata?.tags || "[]").join(", ");
    } catch {
      return "";
    }
  });
  const [visibility, setVisibility] = useState(metadata?.visibility || "public");

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const backdropUrl = getTmdbImageUrl(show.backdropPath, "backdrop");
  const posterUrl = getTmdbImageUrl(show.posterPath, "poster") || "https://placehold.co/300x450/1a1a1a/cccccc?text=No+Poster";

  const handleSaveMetadata = () => {
    const tags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    notify.bg({
      title: "Save Show Metadata",
      loadingMessage: `Saving metadata for '${show.title}' in background...`,
      successMessage: `Metadata for '${show.title}' saved successfully!`,
      errorMessage: (err) => `Failed to save metadata: ${err?.message || String(err)}`,
      task: () =>
        updateShowMetadataAction(show.traktId, {
          favorite,
          personalRating: personalRating === "" ? null : Number(personalRating),
          review: review.trim() || null,
          notes: notes.trim() || null,
          tags,
          visibility,
        }),
    });
  };

  const handleToggleCollection = (collectionId: string) => {
    const isAdded = currentCollections.some((c) => c.id === collectionId);
    notify.bg({
      title: "Collection Update",
      loadingMessage: `Updating collection for '${show.title}'...`,
      successMessage: isAdded
        ? `Removed '${show.title}' from collection.`
        : `Added '${show.title}' to collection!`,
      errorMessage: "Failed to update collection.",
      task: async () => {
        if (isAdded) {
          return await removeItemFromCollectionAction(collectionId, "show", show.traktId);
        } else {
          return await addItemToCollectionAction(collectionId, "show", show.traktId);
        }
      },
    });
  };

  return (
    <div style={{ paddingBottom: "60px" }}>
      <div style={{ marginBottom: "16px" }}>
        <Link href="/libraries/shows" className="btn btn-sm btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={14} /> Back to TV Shows
        </Link>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "320px",
          borderRadius: "12px",
          overflow: "hidden",
          background: backdropUrl ? `url(${backdropUrl}) center/cover no-repeat` : "linear-gradient(135deg, #1f1f1f, #0d0d0d)",
          marginBottom: "24px",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,15,15,1) 0%, rgba(15,15,15,0.4) 60%, rgba(0,0,0,0.2) 100%)" }} />

        <div className="library-detail-hero-content">
          <img src={posterUrl} alt={show.title} className="library-detail-poster" />

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 6px 0" }}>{show.title}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "var(--text-muted)", alignItems: "center" }}>
              <span>{show.year || "N/A"}</span>
              <span>• Status: {show.status || "Ongoing"}</span>
              <span>• {episodes.length} Episodes Logged</span>
            </div>
          </div>
        </div>
      </div>

      <div className="library-detail-grid">
        {/* Left: Provider Read-Only Info */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            📺 Provider TV Information
          </h2>

          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>Overview</div>
            <p style={{ fontSize: "14px", lineHeight: 1.6, marginTop: "4px" }}>{show.overview || "No overview provided."}</p>
          </div>

          <div className="library-detail-subgrid" style={{ fontSize: "13px" }}>
            <div><span style={{ color: "var(--text-muted)" }}>TMDB ID:</span> {show.tmdbId || "N/A"}</div>
            <div><span style={{ color: "var(--text-muted)" }}>Trakt ID:</span> {show.traktId}</div>
            <div>
              <a href={`https://trakt.tv/shows/${show.traktId}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-color)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                Trakt Link <ExternalLink size={12} />
              </a>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Watched Episodes ({episodes.length})</div>
            <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "4px", padding: "8px" }}>
              {episodes.length === 0 && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No episode breakdown available.</div>}
              {episodes.map((ep) => (
                <div key={ep.id} style={{ fontSize: "12px", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
                  <span>S{ep.seasonNumber} E{ep.episodeNumber} - {ep.title || "Episode"}</span>
                  <span style={{ color: "var(--text-muted)" }}>{ep.watchedAt ? new Date(ep.watchedAt).toLocaleDateString() : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Personal Metadata */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px", border: "1px solid var(--accent-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--accent-color)" }}>
              ✍️ CMS Personal Metadata
            </h2>

            <button className="btn btn-sm btn-primary" onClick={handleSaveMetadata} disabled={saving}>
              {savedSuccess ? <Check size={14} /> : <Save size={14} />}
              <span>{saving ? "Saving..." : savedSuccess ? "Saved!" : "Save Metadata"}</span>
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
            <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
            <Heart size={16} fill={favorite ? "var(--accent-color)" : "none"} color={favorite ? "var(--accent-color)" : "currentColor"} />
            <span>Favorite Show</span>
          </label>

          <div className="library-detail-subgrid">
            <div>
              <label className="label">Personal Rating (1 - 10)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                className="text-input"
                placeholder="e.g. 9"
                value={personalRating}
                onChange={(e) => setPersonalRating(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>

            <div>
              <label className="label">Visibility</label>
              <select className="select-input" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Tags (comma separated)</label>
            <input type="text" className="text-input" placeholder="e.g. drama, masterpiece, favorite-series" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>

          <div>
            <label className="label">Personal Review</label>
            <textarea className="text-input" rows={4} placeholder="Write your review of this series..." value={review} onChange={(e) => setReview(e.target.value)} />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="text-input" rows={3} placeholder="Private notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
