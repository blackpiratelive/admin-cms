"use client";

import React, { useState, useEffect } from "react";
import { CombinedMovie } from "../types";
import { getTmdbImageUrl } from "../utils/images";
import { updateMovieMetadataAction } from "../actions/movies";
import { addItemToCollectionAction, removeItemFromCollectionAction } from "../actions/collections";
import { getLocations } from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import { CollectionRecord, LocationRecord, TripRecord } from "@/db/schema";
import { Heart, Star, Tag, Eye, ArrowLeft, ExternalLink, FolderPlus, Save, Check, MapPin, Compass, Loader2 } from "lucide-react";
import Link from "next/link";

interface MovieDetailViewProps {
  movieData: CombinedMovie;
  allCollections: CollectionRecord[];
}

export function MovieDetailView({ movieData, allCollections }: MovieDetailViewProps) {
  const { movie, metadata, collections: currentCollections } = movieData;

  // Editable Form state
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
  const [featured, setFeatured] = useState(metadata?.featured === 1);
  const [locationId, setLocationId] = useState(metadata?.locationId || "");
  const [tripId, setTripId] = useState(metadata?.tripId || "");

  const [locationsList, setLocationsList] = useState<LocationRecord[]>([]);
  const [tripsList, setTripsList] = useState<TripRecord[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadEntities = async () => {
    if (locationsList.length > 0 && tripsList.length > 0) return;
    setIsLoadingEntities(true);
    try {
      const [locs, trps] = await Promise.all([getLocations(), getTrips()]);
      setLocationsList(locs);
      setTripsList(trps);
    } catch (err) {
      console.error("Failed to load locations or trips:", err);
    } finally {
      setIsLoadingEntities(false);
    }
  };

  const backdropUrl = getTmdbImageUrl(movie.backdropPath, "backdrop");
  const posterUrl = getTmdbImageUrl(movie.posterPath, "poster") || "https://placehold.co/300x450/1a1a1a/cccccc?text=No+Poster";

  let genres: string[] = [];
  try {
    genres = JSON.parse(movie.genres || "[]");
  } catch {}

  const handleSaveMetadata = async () => {
    setSaving(true);
    setSavedSuccess(false);

    const tags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    try {
      await updateMovieMetadataAction(movie.traktId, {
        favorite,
        personalRating: personalRating === "" ? null : Number(personalRating),
        review: review.trim() || null,
        notes: notes.trim() || null,
        tags,
        visibility,
        featured,
        locationId: locationId || null,
        tripId: tripId || null,
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCollection = async (collectionId: string) => {
    const isAdded = currentCollections.some((c) => c.id === collectionId);
    if (isAdded) {
      await removeItemFromCollectionAction(collectionId, "movie", movie.traktId);
    } else {
      await addItemToCollectionAction(collectionId, "movie", movie.traktId);
    }
    window.location.reload();
  };

  return (
    <div style={{ paddingBottom: "60px" }}>
      {/* Top Navigation */}
      <div style={{ marginBottom: "16px" }}>
        <Link href="/libraries/movies" className="btn btn-sm btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={14} /> Back to Movies
        </Link>
      </div>

      {/* Hero Backdrop Banner */}
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(15,15,15,1) 0%, rgba(15,15,15,0.4) 60%, rgba(0,0,0,0.2) 100%)",
          }}
        />

        <div className="library-detail-hero-content">
          <img
            src={posterUrl}
            alt={movie.title}
            className="library-detail-poster"
            style={{
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            }}
          />

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 6px 0" }}>{movie.title}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "13px", color: "var(--text-muted)", alignItems: "center" }}>
              <span>{movie.year || "N/A"}</span>
              {movie.runtime && <span>• {movie.runtime} min</span>}
              {movie.rating && (
                <span style={{ color: "#f5c518", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Star size={14} fill="currentColor" /> Trakt: {movie.rating.toFixed(1)}/10
                </span>
              )}
              {movie.watchedAt && (
                <span>• Watched: {new Date(movie.watchedAt).toLocaleDateString()}</span>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
              {genres.map((g) => (
                <span key={g} className="badge badge-secondary">
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout: Provider Read-Only Info (Left) + CMS Metadata Editor (Right) */}
      <div className="library-detail-grid">
        {/* Left Column: Read-Only Provider Metadata */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: 0, borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            🎬 Trakt / TMDB Canonical Provider Data
          </h2>

          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Overview</div>
            <p style={{ fontSize: "14px", lineHeight: 1.6, marginTop: "4px", color: "var(--text-color)" }}>
              {movie.overview || "No overview available from provider."}
            </p>
          </div>

          <div className="library-detail-subgrid" style={{ fontSize: "13px" }}>
            <div>
              <span style={{ color: "var(--text-muted)" }}>TMDB ID:</span> {movie.tmdbId ? movie.tmdbId : "N/A"}
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Trakt ID:</span> {movie.traktId}
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Watched At:</span> {movie.watchedAt ? new Date(movie.watchedAt).toLocaleString() : "Unspecified"}
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>External Link:</span>{" "}
              <a href={`https://trakt.tv/movies/${movie.traktId}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-color)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                Trakt <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Collections list */}
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <FolderPlus size={14} /> Collections ({currentCollections.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {allCollections.map((c) => {
                const inCol = currentCollections.some((cur) => cur.id === c.id);
                return (
                  <button
                    key={c.id}
                    className={`btn btn-sm ${inCol ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => handleToggleCollection(c.id)}
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                  >
                    {inCol ? "✓ " : "+ "} {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Editable CMS Personal Metadata */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px", border: "1px solid var(--accent-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "var(--accent-color)" }}>
              ✍️ CMS Personal Metadata
            </h2>

            <button className="btn btn-sm btn-primary" onClick={handleSaveMetadata} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : savedSuccess ? <Check size={14} /> : <Save size={14} />}
              <span>{saving ? "Saving..." : savedSuccess ? "Saved!" : "Save Metadata"}</span>
            </button>
          </div>

          <div className="library-detail-subgrid">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
              <Heart size={16} fill={favorite ? "var(--accent-color)" : "none"} color={favorite ? "var(--accent-color)" : "currentColor"} />
              <span>Favorite</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              <span>Featured on Homepage</span>
            </label>
          </div>

          <div className="library-detail-subgrid">
            <div>
              <label className="label">My Personal Rating (1 - 10)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                className="text-input"
                placeholder="e.g. 9.5"
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

          {/* New Location & Trip Selectors replacing old watch location input */}
          <div className="library-detail-subgrid">
            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MapPin size={13} style={{ color: "var(--accent-color)" }} />
                <span>Associated Location</span>
                {isLoadingEntities && <Loader2 size={12} className="animate-spin" />}
              </label>
              <select
                className="select-input"
                value={locationId}
                onFocus={loadEntities}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">-- None (No Location) --</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {[loc.city, loc.country].filter(Boolean).length ? `(${[loc.city, loc.country].filter(Boolean).join(", ")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Compass size={13} style={{ color: "var(--accent-color)" }} />
                <span>Associated Trip</span>
                {isLoadingEntities && <Loader2 size={12} className="animate-spin" />}
              </label>
              <select
                className="select-input"
                value={tripId}
                onFocus={loadEntities}
                onChange={(e) => setTripId(e.target.value)}
              >
                <option value="">-- None (No Trip) --</option>
                {tripsList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Tags (comma separated)</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. sci-fi, rewatch, mindbending"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Personal Review / Critical Thoughts</label>
            <textarea
              className="text-input"
              rows={4}
              placeholder="Write your personal review or essay about this movie..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Private Notes & Thoughts</label>
            <textarea
              className="text-input"
              rows={3}
              placeholder="Private notes (never shown publicly)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
