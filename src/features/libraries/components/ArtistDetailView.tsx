"use client";

import React, { useState } from "react";
import { CombinedArtist } from "../types";
import { updateArtistMetadataAction } from "../actions/music";
import { addItemToCollectionAction, removeItemFromCollectionAction } from "../actions/collections";
import { CollectionRecord } from "@/db/schema";
import { Heart, Music, ArrowLeft, Save, Check } from "lucide-react";
import Link from "next/link";

interface ArtistDetailViewProps {
  artistData: CombinedArtist;
  allCollections: CollectionRecord[];
}

export function ArtistDetailView({ artistData, allCollections }: ArtistDetailViewProps) {
  const { artist, metadata, collections: currentCollections } = artistData;

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

  const handleSaveMetadata = async () => {
    setSaving(true);
    setSavedSuccess(false);

    const tags = tagsInput
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);

    try {
      await updateArtistMetadataAction(artist.artistName, {
        favorite,
        personalRating: personalRating === "" ? null : Number(personalRating),
        review: review.trim() || null,
        notes: notes.trim() || null,
        tags,
        visibility,
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
      await removeItemFromCollectionAction(collectionId, "artist", artist.artistName);
    } else {
      await addItemToCollectionAction(collectionId, "artist", artist.artistName);
    }
    window.location.reload();
  };

  return (
    <div style={{ paddingBottom: "60px" }}>
      <div style={{ marginBottom: "16px" }}>
        <Link href="/libraries/music" className="btn btn-sm btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <ArrowLeft size={14} /> Back to Music
        </Link>
      </div>

      <div className="card" style={{ marginBottom: "24px", display: "flex", gap: "20px", alignItems: "center" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "var(--accent-color)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: "32px",
          }}
        >
          {artist.artistName[0].toUpperCase()}
        </div>

        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0" }}>{artist.artistName}</h1>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", gap: "16px" }}>
            <span>{artist.playCount} Total Scrobbles</span>
            {artist.firstPlayed && <span>First Played: {new Date(artist.firstPlayed).toLocaleDateString()}</span>}
            {artist.lastPlayed && <span>Last Played: {new Date(artist.lastPlayed).toLocaleDateString()}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Collections */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0, borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
            📁 Collections Assignment
          </h2>
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

        {/* CMS Personal Metadata */}
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
            <span>Favorite Artist</span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="label">Personal Rating (1 - 10)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                className="text-input"
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
            <input type="text" className="text-input" placeholder="e.g. indie, electronic, favorite" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>

          <div>
            <label className="label">Notes & Thoughts</label>
            <textarea className="text-input" rows={4} placeholder="Personal notes about this artist..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
