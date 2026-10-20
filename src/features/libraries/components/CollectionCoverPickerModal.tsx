"use client";

import React, { useEffect, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import type { CollectionPhotoItem } from "../collection-types";
import { CollectionsModal } from "./CollectionsModal";

interface CollectionCoverPickerModalProps {
  isOpen: boolean;
  collectionName: string;
  photos: CollectionPhotoItem[];
  currentCoverId: string | null;
  onClose: () => void;
  onSelect: (
    photoId: string | null
  ) => Promise<{ success: boolean; error?: string }>;
}

export function CollectionCoverPickerModal({
  isOpen,
  collectionName,
  photos,
  currentCoverId,
  onClose,
  onSelect,
}: CollectionCoverPickerModalProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBusyId(null);
    setError(null);
  }, [isOpen]);

  const choose = async (photoId: string | null) => {
    setBusyId(photoId || "automatic");
    setError(null);
    try {
      const result = await onSelect(photoId);
      if (!result.success) {
        setError(result.error || "Could not update the cover.");
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the cover.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <CollectionsModal
      isOpen={isOpen}
      onClose={busyId ? () => undefined : onClose}
      title="Choose a cover"
      description={`Pick a photo from “${collectionName}” or let Collections choose one automatically.`}
      size="xl"
    >
      <div className="collections-cover-picker">
        <button
          type="button"
          className={`collections-cover-auto ${currentCoverId === null ? "is-active" : ""}`}
          onClick={() => choose(null)}
          disabled={Boolean(busyId)}
        >
          <span className="collections-cover-auto-icon">
            {busyId === "automatic" ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />}
          </span>
          <span>
            <strong>Automatic</strong>
            <small>Use the earliest photo or first available poster.</small>
          </span>
          {currentCoverId === null && <Check size={16} />}
        </button>

        {photos.length === 0 ? (
          <div className="collections-picker-empty">
            <ImageIcon size={28} />
            <h3>No photos in this collection</h3>
            <p>Add photos to the Content tab to choose a manual cover.</p>
          </div>
        ) : (
          <div className="collections-cover-grid">
            {photos.map((photo) => {
              const active = currentCoverId === photo.id;
              const busy = busyId === photo.id;
              return (
                <button
                  key={photo.id}
                  type="button"
                  className={`collections-cover-option ${active ? "is-active" : ""}`}
                  onClick={() => choose(photo.id)}
                  disabled={Boolean(busyId)}
                  aria-pressed={active}
                  title={photo.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.thumbnailUrl} alt={photo.title} loading="lazy" />
                  <span className="collections-cover-option-label">{photo.title}</span>
                  {photo.visibility !== "public" && (
                    <span className="collections-cover-option-visibility">
                      {photo.visibility}
                    </span>
                  )}
                  {(active || busy) && (
                    <span className="collections-cover-option-check">
                      {busy ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {error && <div className="collections-form-error">{error}</div>}
      </div>
    </CollectionsModal>
  );
}
