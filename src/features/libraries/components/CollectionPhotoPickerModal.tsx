"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Image as ImageIcon,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { getGalleryPhotos } from "@/features/gallery/actions";
import { notify } from "@/lib/notifications";
import type { GalleryPhoto } from "@/db/schema";
import { CollectionsModal } from "./CollectionsModal";

interface CollectionPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  existingPhotoIds: string[];
  onAdd: (
    photoIds: string[]
  ) => Promise<{ success: boolean; error?: string; count?: number }>;
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
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onAdd(Array.from(selected));
      if (!result.success) {
        setError(result.error || "Could not add photos.");
        return;
      }
      const count = result.count ?? selected.size;
      notify.show({
        type: "success",
        message: `${count} photo${count === 1 ? "" : "s"} added.`,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add photos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CollectionsModal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      title="Add photos"
      description={`Choose gallery photos for “${collectionName}”.`}
      size="xl"
      footer={
        <>
          <span className={`collections-picker-count ${error ? "has-error" : ""}`}>
            {error || `${selected.size} selected`}
          </span>
          <div className="collections-picker-footer-actions">
            <button
              type="button"
              className="collections-btn collections-btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="collections-btn collections-btn-primary"
              onClick={handleSubmit}
              disabled={selected.size === 0 || submitting}
            >
              {submitting ? <Loader2 size={15} className="spin" /> : <ImageIcon size={15} />}
              {submitting
                ? "Adding…"
                : `Add ${selected.size || ""} photo${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      }
    >
      <div className="collections-picker">
        <div className="collections-picker-search">
          <Search size={16} aria-hidden="true" />
          <input
            className="collections-input"
            placeholder="Search titles, albums, locations, cameras…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search gallery photos"
          />
          {search && (
            <button
              type="button"
              className="collections-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="collections-picker-loading">
            <Loader2 size={22} className="spin" />
            <span>Loading gallery…</span>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="collections-picker-empty">
            <ImageIcon size={28} />
            <h3>No gallery photos found</h3>
            <p>Try a different search, or upload photos in the Gallery first.</p>
          </div>
        ) : (
          <div className="collections-picker-grid">
            {filteredPhotos.map((photo) => {
              const isExisting = existing.has(photo.id);
              const isSelected = selected.has(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  className={`collections-picker-photo ${
                    isSelected ? "is-selected" : ""
                  } ${isExisting ? "is-existing" : ""}`}
                  onClick={() => togglePhoto(photo)}
                  disabled={isExisting}
                  title={isExisting ? "Already in this collection" : photo.title}
                  aria-pressed={isSelected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnailUrl} alt={photo.title} loading="lazy" />
                  <span className="collections-picker-photo-label">{photo.title}</span>
                  {photo.visibility !== "public" && (
                    <span className="collections-picker-photo-visibility">
                      {photo.visibility}
                    </span>
                  )}
                  {(isSelected || isExisting) && (
                    <span className="collections-picker-photo-check">
                      <Check size={13} />
                    </span>
                  )}
                  {isExisting && (
                    <span className="collections-picker-photo-existing">Added</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </CollectionsModal>
  );
}
