"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Film,
  Heart,
  Image as ImageIcon,
  Images,
  Music,
  Plus,
  Star,
  Trash2,
  Tv,
  User,
  Users,
  X,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import type {
  CollectionDetail,
  CollectionPhotoItem,
} from "../collection-types";
import { ConfirmDialog } from "./CollectionsModal";

type ContentFilter = "all" | "photo" | "movie" | "show" | "music" | "person";

interface CollectionContentTabProps {
  detail: CollectionDetail;
  onOpenPhotoPicker: () => void;
  onRemoveItem: (
    itemType: string,
    itemId: string
  ) => Promise<{ success: boolean; error?: string }>;
}

interface MediaEntry {
  type: "movie" | "show" | "artist" | "album" | "track" | "person";
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  favorite: boolean;
  rating: number | null;
  visibility: string;
  incompatible: boolean;
  icon: React.ReactNode;
}

function mediaIcon(type: MediaEntry["type"]) {
  if (type === "movie") return <Film size={18} />;
  if (type === "show") return <Tv size={18} />;
  if (type === "person") return <User size={18} />;
  return <Music size={18} />;
}

function VisibilityChip({ visibility }: { visibility: string }) {
  if (visibility === "public") return null;
  return (
    <span className={`collections-badge collections-visibility is-${visibility}`}>
      {visibility === "unlisted" ? "Unlisted" : "Private"}
    </span>
  );
}

export function CollectionContentTab({
  detail,
  onOpenPhotoPicker,
  onRemoveItem,
}: CollectionContentTabProps) {
  const { collection, counts } = detail;
  const [activeFilter, setActiveFilter] = useState<ContentFilter>("all");
  const [pendingRemoval, setPendingRemoval] = useState<{
    itemType: string;
    itemId: string;
    title: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowPhotos = collection.kind === "photo" || collection.kind === "mixed";
  const allowMedia = collection.kind === "media" || collection.kind === "mixed";
  const musicCount = counts.artists + counts.albums + counts.tracks;

  const groups = useMemo(() => {
    const next: Array<{ id: ContentFilter; label: string; count: number }> = [];
    if (counts.photos > 0) next.push({ id: "photo", label: "Photos", count: counts.photos });
    if (counts.movies > 0) next.push({ id: "movie", label: "Films", count: counts.movies });
    if (counts.shows > 0) next.push({ id: "show", label: "TV", count: counts.shows });
    if (musicCount > 0) next.push({ id: "music", label: "Music", count: musicCount });
    if (counts.people > 0) next.push({ id: "person", label: "People", count: counts.people });
    return next;
  }, [counts.movies, counts.people, counts.photos, counts.shows, musicCount]);

  useEffect(() => {
    if (
      activeFilter !== "all" &&
      !groups.some((group) => group.id === activeFilter)
    ) {
      setActiveFilter("all");
    }
  }, [activeFilter, groups]);

  const mediaEntries = useMemo<MediaEntry[]>(() => {
    const entries: MediaEntry[] = [];
    for (const movie of detail.movies) {
      entries.push({
        type: "movie",
        id: movie.id,
        title: movie.title,
        subtitle: movie.year ? String(movie.year) : null,
        imageUrl: movie.posterUrl,
        favorite: movie.favorite,
        rating: movie.rating,
        visibility: movie.visibility,
        incompatible: Boolean(movie.incompatible),
        icon: mediaIcon("movie"),
      });
    }
    for (const show of detail.shows) {
      entries.push({
        type: "show",
        id: show.id,
        title: show.title,
        subtitle: show.year ? String(show.year) : show.status,
        imageUrl: show.posterUrl,
        favorite: show.favorite,
        rating: show.rating,
        visibility: show.visibility,
        incompatible: Boolean(show.incompatible),
        icon: mediaIcon("show"),
      });
    }
    for (const artist of detail.artists) {
      entries.push({
        type: "artist",
        id: artist.id,
        title: artist.name,
        subtitle: `${artist.playCount.toLocaleString()} plays`,
        imageUrl: null,
        favorite: artist.favorite,
        rating: artist.rating,
        visibility: artist.visibility,
        incompatible: Boolean(artist.incompatible),
        icon: mediaIcon("artist"),
      });
    }
    for (const album of detail.albums) {
      entries.push({
        type: "album",
        id: album.id,
        title: album.name,
        subtitle: `${album.artist} · ${album.playCount.toLocaleString()} plays`,
        imageUrl: null,
        favorite: album.favorite,
        rating: album.rating,
        visibility: album.visibility,
        incompatible: Boolean(album.incompatible),
        icon: mediaIcon("album"),
      });
    }
    for (const track of detail.tracks) {
      entries.push({
        type: "track",
        id: track.id,
        title: track.name,
        subtitle: `${track.artist} · ${track.playCount.toLocaleString()} plays`,
        imageUrl: null,
        favorite: track.favorite,
        rating: track.rating,
        visibility: track.visibility,
        incompatible: Boolean(track.incompatible),
        icon: mediaIcon("track"),
      });
    }
    for (const person of detail.people) {
      entries.push({
        type: "person",
        id: person.id,
        title: person.name,
        subtitle: null,
        imageUrl: person.avatarUrl,
        favorite: false,
        rating: null,
        visibility: person.visibility,
        incompatible: Boolean(person.incompatible),
        icon: mediaIcon("person"),
      });
    }
    return entries;
  }, [detail.albums, detail.artists, detail.movies, detail.people, detail.shows, detail.tracks]);

  const showPhotos = activeFilter === "all" || activeFilter === "photo";
  const showMedia = activeFilter !== "photo";
  const filteredMedia = mediaEntries.filter((entry) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "movie") return entry.type === "movie";
    if (activeFilter === "show") return entry.type === "show";
    if (activeFilter === "person") return entry.type === "person";
    if (activeFilter === "music") {
      return entry.type === "artist" || entry.type === "album" || entry.type === "track";
    }
    return false;
  });
  const filteredPhotos = showPhotos ? detail.photos : [];
  const visibleCount =
    (showPhotos ? detail.photos.length : 0) +
    (showMedia ? filteredMedia.length : 0);
  const showSplitHeadings = activeFilter === "all" && detail.photos.length > 0 && filteredMedia.length > 0;

  const requestRemoval = (itemType: string, itemId: string, title: string) => {
    setError(null);
    setPendingRemoval({ itemType, itemId, title });
  };

  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onRemoveItem(
        pendingRemoval.itemType,
        pendingRemoval.itemId
      );
      if (!result.success) {
        setError(result.error || "Could not remove the item.");
        return;
      }
      notify.show({ type: "success", message: "Removed from collection." });
      setPendingRemoval(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the item.");
    } finally {
      setBusy(false);
    }
  };

  const renderPhotoCard = (photo: CollectionPhotoItem) => {
    const isCover = collection.coverPhotoId === photo.id;
    return (
      <article key={photo.id} className="collection-photo-card">
        <a
          href={photo.largeUrl}
          target="_blank"
          rel="noreferrer"
          className="collection-photo-link"
          title={`Open ${photo.title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumbnailUrl} alt={photo.title} loading="lazy" />
          <span className="collection-photo-shade" aria-hidden="true" />
          <span className="collection-photo-flags">
            {isCover && <span className="collections-badge is-cover">Cover</span>}
            <VisibilityChip visibility={photo.visibility} />
            {photo.incompatible && <span className="collections-badge is-not-shared">Not shared</span>}
          </span>
          <span className="collection-photo-title">{photo.title}</span>
        </a>
        <button
          type="button"
          className="collection-photo-remove"
          onClick={() => requestRemoval("photo", photo.id, photo.title)}
          aria-label={`Remove ${photo.title} from this collection`}
          title="Remove from collection"
        >
          <X size={13} />
        </button>
      </article>
    );
  };

  const renderMediaCard = (entry: MediaEntry) => (
    <article key={`${entry.type}-${entry.id}`} className="collection-media-card">
      <div className="collection-media-art">
        {entry.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.imageUrl} alt="" loading="lazy" />
        ) : (
          <span className="collection-media-fallback">{entry.icon}</span>
        )}
      </div>
      <div className="collection-media-body">
        <div className="collection-media-title" title={entry.title}>
          {entry.title}
        </div>
        <div className="collection-media-subtitle">
          {entry.subtitle || "No details"}
          {entry.favorite && <Heart size={11} fill="currentColor" className="is-favorite" />}
          {entry.rating != null && (
            <span className="collection-media-rating">
              <Star size={11} fill="currentColor" /> {entry.rating}
            </span>
          )}
        </div>
        <div className="collection-media-badges">
          <VisibilityChip visibility={entry.visibility} />
          {entry.incompatible && <span className="collections-badge is-not-shared">Not shared</span>}
        </div>
      </div>
      <button
        type="button"
        className="collections-icon-btn collections-icon-btn-sm collection-media-remove"
        onClick={() => requestRemoval(entry.type, entry.id, entry.title)}
        aria-label={`Remove ${entry.title} from this collection`}
        title="Remove from collection"
      >
        <Trash2 size={13} />
      </button>
    </article>
  );

  return (
    <div className="collection-panel" role="tabpanel" id="collection-panel-content" aria-labelledby="collection-tab-content">
      <div className="collection-panel-head">
        <div>
          <h2>Content</h2>
          <p>
            {counts.total === 0
              ? "This collection is ready for its first item."
              : `${counts.total} ${counts.total === 1 ? "item" : "items"} in this collection.`}
          </p>
        </div>
        {allowPhotos && (
          <button
            type="button"
            className="collections-btn collections-btn-primary"
            onClick={onOpenPhotoPicker}
          >
            <Plus size={15} /> Add photos
          </button>
        )}
      </div>

      {error && <div className="collections-form-error">{error}</div>}

      {detail.incompatibleCount > 0 && (
        <div className="collections-notice is-warning">
          <strong>{detail.incompatibleCount} item{detail.incompatibleCount === 1 ? "" : "s"} no longer match this collection type.</strong>
          <span>
            They stay in the collection and remain visible here, but are hidden from
            the shared page. Remove them or switch the type back to share them again.
          </span>
        </div>
      )}

      {detail.unsupportedCount > 0 && (
        <div className="collections-notice">
          This collection also contains {detail.unsupportedCount} legacy item
          {detail.unsupportedCount === 1 ? "" : "s"} that are not shown by the sharing
          page (books, projects, locations, trips, notes, bookmarks, or quotes).
        </div>
      )}

      {groups.length > 1 && (
        <nav className="collection-content-chips" aria-label="Filter collection content">
          <button
            type="button"
            className={`collections-chip ${activeFilter === "all" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("all")}
            aria-pressed={activeFilter === "all"}
          >
            All <span className="collections-chip-count">{counts.total}</span>
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`collections-chip ${activeFilter === group.id ? "is-active" : ""}`}
              onClick={() => setActiveFilter(group.id)}
              aria-pressed={activeFilter === group.id}
            >
              {group.label} <span className="collections-chip-count">{group.count}</span>
            </button>
          ))}
        </nav>
      )}

      {visibleCount === 0 ? (
        <div className="collections-empty collections-empty-compact">
          <span className="collections-empty-icon">
            <Images size={26} />
          </span>
          <div>
            <h2>{counts.total === 0 ? "Nothing here yet" : "No items in this filter"}</h2>
            <p>
              {counts.total === 0
                ? allowPhotos
                  ? "Add photos to start this album, or add media from its own detail page."
                  : "Open a film, show, artist, album, track, or person and add it to this collection."
                : "Choose another content filter to see the rest of the collection."}
            </p>
          </div>
          {allowPhotos && counts.total === 0 && (
            <button
              type="button"
              className="collections-btn collections-btn-primary"
              onClick={onOpenPhotoPicker}
            >
              <Plus size={15} /> Add photos
            </button>
          )}
        </div>
      ) : (
        <div className="collection-content">
          {showPhotos && filteredPhotos.length > 0 && (
            <section className="collection-content-section">
              {showSplitHeadings && (
                <div className="collection-content-section-head">
                  <ImageIcon size={14} /> Photos <span>{filteredPhotos.length}</span>
                </div>
              )}
              <div className="collection-photo-grid">
                {filteredPhotos.map(renderPhotoCard)}
              </div>
            </section>
          )}

          {showMedia && filteredMedia.length > 0 && (
            <section className="collection-content-section">
              {showSplitHeadings && (
                <div className="collection-content-section-head">
                  <Film size={14} /> Media <span>{filteredMedia.length}</span>
                </div>
              )}
              <div className="collection-media-grid">
                {filteredMedia.map(renderMediaCard)}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="collection-content-note">
        <Users size={13} /> Media is added from its own detail page. Remove it here at
        any time without deleting the original item.
      </p>

      <ConfirmDialog
        isOpen={Boolean(pendingRemoval)}
        title="Remove from collection?"
        description={
          <>
            <strong>{pendingRemoval?.title}</strong> will be removed from this
            collection. The item itself will not be deleted.
          </>
        }
        confirmLabel="Remove item"
        tone="danger"
        busy={busy}
        onConfirm={confirmRemoval}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
