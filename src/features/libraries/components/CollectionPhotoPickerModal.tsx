"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Search, X } from "lucide-react";
import { getGalleryPhotos } from "@/features/gallery/actions";
import type { GalleryPhoto } from "@/db/schema";

interface CollectionPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  existingPhotoIds: string[];
  onAdd: (photoIds: string[]) => Promise<{ success: boolean; error?: string; count?: number }>;
  onSuccess?: () => void;
}

export function CollectionPhotoPickerModal({
  isOpen,
  onClose,
  collectionName,
  existingPhotoIds,
  onAdd,
  onSuccess,
}: CollectionPhotoPickerModalProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => new Set(existingPhotoIds), [existingPhotoIds]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setSearch("");
    setError(null);
    setLoading(true);
    getGalleryPhotos()
      .then((rows) => setPhotos(rows))
      .catch(() => setError("Could not load gallery photos."))
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return photos;
    return photos.filter((photo) => {
      return (
        photo.title.toLowerCase().includes(query) ||
        (photo.album || "").toLowerCase().includes(query) ||
        (photo.locationName || "").toLowerCase().includes(query) ||
        (photo.camera || "").toLowerCase().includes(query)
      );
    });
  }, [photos, search]);

  if (!isOpen) return null;

  const togglePhoto = (photo: GalleryPhoto) => {
    if (existing.has(photo.id)) return;
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onAdd(Array.from(selected));
      if (!result.success) {
        setError(result.error || "Could not add photos.");
        return;
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Could not add photos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        className="card"
        style={{
          display: "flex",
          width: "min(980px, 100%)",
          maxHeight: "88vh",
          flexDirection: "column",
          overflow: "hidden",
          padding: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "16px 18px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>Add Photos</h2>
            <div style={{ marginTop: "3px", fontSize: "12px", color: "var(--text-muted)" }}>
              Choose gallery photos for <strong>{collectionName}</strong>
            </div>
          </div>
          <button className="btn btn-sm btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              className="text-input"
              placeholder="Search titles, albums, locations, cameras..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ paddingLeft: "32px" }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "48px", color: "var(--text-muted)" }}>
              <Loader2 size={22} className="spin" />
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
              <ImageIcon size={28} style={{ marginBottom: "8px" }} />
              <div>No gallery photos found.</div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "10px",
              }}
            >
              {filteredPhotos.map((photo) => {
                const isExisting = existing.has(photo.id);
                const isSelected = selected.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => togglePhoto(photo)}
                    disabled={isExisting}
                    title={isExisting ? "Already in this collection" : photo.title}
                    style={{
                      position: "relative",
                      display: "block",
                      padding: 0,
                      overflow: "hidden",
                      aspectRatio: "1 / 1",
                      background: "var(--bg-sidebar)",
                      border: isSelected
                        ? "2px solid var(--accent-color)"
                        : "1px solid var(--border-color)",
                      borderRadius: "6px",
                      cursor: isExisting ? "default" : "pointer",
                      opacity: isExisting ? 0.42 : 1,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        inset: "auto 0 0 0",
                        padding: "18px 7px 6px",
                        background: "linear-gradient(transparent, rgba(0,0,0,0.82))",
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: 600,
                        textAlign: "left",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {photo.title}
                    </span>
                    {(isSelected || isExisting) && (
                      <span
                        style={{
                          position: "absolute",
                          top: "7px",
                          right: "7px",
                          display: "grid",
                          placeItems: "center",
                          width: "22px",
                          height: "22px",
                          borderRadius: "999px",
                          background: isExisting ? "rgba(0,0,0,0.55)" : "var(--accent-color)",
                          color: "#fff",
                        }}
                      >
                        <Check size={13} />
                      </span>
                    )}
                    {photo.visibility !== "public" && (
                      <span
                        style={{
                          position: "absolute",
                          top: "7px",
                          left: "7px",
                          padding: "2px 6px",
                          borderRadius: "999px",
                          background: "rgba(0,0,0,0.65)",
                          color: "#e4e4e7",
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {photo.visibility}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "13px 18px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <div style={{ fontSize: "12px", color: error ? "#f87171" : "var(--text-muted)" }}>
            {error || `${selected.size} selected`}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleSubmit}
              disabled={selected.size === 0 || submitting}
            >
              {submitting ? <Loader2 size={14} className="spin" /> : null}
              {submitting ? "Adding..." : `Add ${selected.size || ""} photo${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
