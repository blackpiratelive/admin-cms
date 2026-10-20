"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Globe,
  Heart,
  Image as ImageIcon,
  Loader2,
  Lock,
  Music,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Tv,
  Users,
  X,
} from "lucide-react";
import type { CollectionRecord } from "@/db/schema";
import {
  addPhotosToCollectionAction,
  deleteCollectionAction,
  getCollectionDetailAction,
  regenerateCollectionShareTokenAction,
  removeItemFromCollectionAction,
  removePhotoFromCollectionAction,
  setCollectionVisibilityAction,
  updateCollectionAction,
} from "../actions/collections";
import {
  collectionKindLabel,
  collectionVisibilityLabel,
  type CollectionKind,
  type CollectionVisibility,
} from "../collection-helpers";
import { sumCollectionCounts, type CollectionDetail } from "../collection-types";
import { CollectionPhotoPickerModal } from "./CollectionPhotoPickerModal";
import { notify } from "@/lib/notifications";

interface CollectionDetailViewProps {
  detail: CollectionDetail;
}

export function CollectionDetailView({ detail }: CollectionDetailViewProps) {
  const router = useRouter();
  const [collection, setCollection] = useState<CollectionRecord>(detail.collection);
  const [photos, setPhotos] = useState(detail.photos);
  const [movies, setMovies] = useState(detail.movies);
  const [shows, setShows] = useState(detail.shows);
  const [artists, setArtists] = useState(detail.artists);
  const [albums, setAlbums] = useState(detail.albums);
  const [tracks, setTracks] = useState(detail.tracks);
  const [people, setPeople] = useState(detail.people);
  const [sharePath, setSharePath] = useState(detail.sharePath);

  const [name, setName] = useState(detail.collection.name);
  const [description, setDescription] = useState(detail.collection.description || "");
  const [color, setColor] = useState(detail.collection.color || "#ff6600");
  const [kind, setKind] = useState<CollectionKind>(detail.collection.kind);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const counts = useMemo(() => {
    const next = {
      photos: photos.length,
      movies: movies.length,
      shows: shows.length,
      artists: artists.length,
      albums: albums.length,
      tracks: tracks.length,
      people: people.length,
      total: 0,
    };
    next.total = sumCollectionCounts(next);
    return next;
  }, [photos, movies, shows, artists, albums, tracks, people]);

  const totalMedia = counts.movies + counts.shows + counts.artists + counts.albums + counts.tracks + counts.people;
  const showPhotos = collection.kind === "photo" || collection.kind === "mixed";
  const showMedia = collection.kind === "media" || collection.kind === "mixed";

  const refreshDetail = async () => {
    const refreshed = await getCollectionDetailAction(collection.slug);
    if (!refreshed) return;
    setCollection(refreshed.collection);
    setPhotos(refreshed.photos);
    setMovies(refreshed.movies);
    setShows(refreshed.shows);
    setArtists(refreshed.artists);
    setAlbums(refreshed.albums);
    setTracks(refreshed.tracks);
    setPeople(refreshed.people);
    setSharePath(refreshed.sharePath);
    setName(refreshed.collection.name);
    setDescription(refreshed.collection.description || "");
    setColor(refreshed.collection.color || "#ff6600");
    setKind(refreshed.collection.kind);
    router.refresh();
  };

  const copyShareLink = async (path?: string | null) => {
    const target = path || sharePath;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${target}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify.show({ type: "success", message: "Share link copied." });
    } catch {
      notify.show({ type: "error", message: "Could not copy the link." });
    }
  };

  const handleVisibility = async (visibility: CollectionVisibility) => {
    if (visibility === collection.visibility) return;
    if (visibility === "private" && !confirm("Make this collection private? Existing share links will stop working.")) {
      return;
    }
    setIsUpdatingShare(true);
    setError(null);
    try {
      const result = await setCollectionVisibilityAction(collection.id, visibility);
      if (!result.success) {
        setError(result.error || "Could not update visibility.");
        return;
      }
      const nextPath = "sharePath" in result ? result.sharePath : null;
      setCollection((previous) => ({
        ...previous,
        visibility,
        shareToken: visibility === "unlisted" ? previous.shareToken : previous.shareToken,
      }));
      setSharePath(nextPath || null);
      if (visibility === "unlisted" && nextPath) {
        await copyShareLink(nextPath);
      }
      router.refresh();
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Regenerate the share token? The old link will stop working.")) return;
    setIsUpdatingShare(true);
    setError(null);
    try {
      const result = await regenerateCollectionShareTokenAction(collection.id);
      if (!result.success) {
        setError(result.error || "Could not regenerate the token.");
        return;
      }
      if ("sharePath" in result) {
        setSharePath(result.sharePath || null);
        await copyShareLink(result.sharePath || null);
      }
      router.refresh();
    } finally {
      setIsUpdatingShare(false);
    }
  };

  const handleSaveMetadata = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateCollectionAction(collection.id, {
        name,
        description: description.trim() || null,
        color,
        kind,
      });
      if (!result.success) {
        setError(result.error || "Could not save the collection.");
        return;
      }
      setCollection((previous) => ({
        ...previous,
        name: name.trim(),
        description: description.trim() || null,
        color,
        kind,
      }));
      notify.show({ type: "success", message: "Collection settings saved." });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPhotos = async (photoIds: string[]) => {
    const result = await addPhotosToCollectionAction(collection.id, photoIds);
    if (result.success) {
      try {
        await refreshDetail();
      } catch {
        router.refresh();
      }
    }
    return result;
  };

  const handleRemovePhoto = (photoId: string) => {
    if (!confirm("Remove this photo from the collection? The photo itself will not be deleted.")) return;
    setPhotos((previous) => previous.filter((photo) => photo.id !== photoId));
    notify.bg({
      title: "Remove Photo",
      loadingMessage: "Removing photo from collection...",
      successMessage: "Photo removed from collection.",
      errorMessage: "Could not remove the photo.",
      task: () => removePhotoFromCollectionAction(collection.id, photoId),
      onSuccess: () => router.refresh(),
      onError: () => refreshDetail(),
    });
  };

  const handleRemoveMedia = (itemType: string, itemId: string) => {
    if (!confirm("Remove this item from the collection? The item itself will not be deleted.")) return;
    setMovies((previous) => (itemType === "movie" ? previous.filter((item) => item.id !== itemId) : previous));
    setShows((previous) => (itemType === "show" ? previous.filter((item) => item.id !== itemId) : previous));
    setArtists((previous) => (itemType === "artist" ? previous.filter((item) => item.id !== itemId) : previous));
    setAlbums((previous) => (itemType === "album" ? previous.filter((item) => item.id !== itemId) : previous));
    setTracks((previous) => (itemType === "track" ? previous.filter((item) => item.id !== itemId) : previous));
    setPeople((previous) => (itemType === "person" ? previous.filter((item) => item.id !== itemId) : previous));

    notify.bg({
      title: "Remove Item",
      loadingMessage: "Removing item from collection...",
      successMessage: "Item removed from collection.",
      errorMessage: "Could not remove the item.",
      task: () => removeItemFromCollectionAction(collection.id, itemType, itemId),
      onSuccess: () => router.refresh(),
      onError: () => refreshDetail(),
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete the collection "${collection.name}"? The items themselves will not be deleted.`)) return;
    notify.bg({
      title: "Delete Collection",
      loadingMessage: "Deleting collection...",
      successMessage: "Collection deleted.",
      errorMessage: "Could not delete the collection.",
      task: () => deleteCollectionAction(collection.id),
      onSuccess: () => router.push("/libraries/collections"),
    });
  };

  const shareUrl = sharePath ? `${origin}${sharePath}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px", paddingBottom: "60px" }}>
      <div>
        <Link
          href="/libraries/collections"
          className="btn btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", marginBottom: "14px" }}
        >
          <ArrowLeft size={13} /> All Collections
        </Link>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
              <span className="badge">{collectionKindLabel(collection.kind)}</span>
              <span
                className="badge"
                style={{
                  color:
                    collection.visibility === "public"
                      ? "#22c55e"
                      : collection.visibility === "unlisted"
                        ? "var(--accent-color)"
                        : "var(--text-muted)",
                }}
              >
                {collectionVisibilityLabel(collection.visibility)}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, letterSpacing: "-0.03em" }}>
              {collection.name}
            </h1>
            {collection.description && (
              <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "13px", maxWidth: "720px" }}>
                {collection.description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {sharePath && (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => copyShareLink()}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={sharePath}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <ExternalLink size={13} /> Preview
                </a>
              </>
            )}
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleDelete}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: "10px 14px", color: "#f87171", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {detail.unsupportedCount > 0 && (
        <div
          className="card"
          style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "12px" }}
        >
          This collection also contains {detail.unsupportedCount} legacy item
          {detail.unsupportedCount === 1 ? "" : "s"} that are not shown by the sharing page
          (books, projects, locations, trips, notes, bookmarks, or quotes).
        </div>
      )}

      {/* Share settings */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Globe size={16} style={{ color: "var(--accent-color)" }} />
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Sharing</h2>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {(["private", "unlisted", "public"] as CollectionVisibility[]).map((visibility) => {
            const active = collection.visibility === visibility;
            const Icon = visibility === "private" ? Lock : visibility === "public" ? Globe : EyeOff;
            return (
              <button
                key={visibility}
                type="button"
                className={`btn btn-sm ${active ? "btn-primary" : ""}`}
                onClick={() => handleVisibility(visibility)}
                disabled={isUpdatingShare}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <Icon size={13} />
                {collectionVisibilityLabel(visibility)}
              </button>
            );
          })}
          {isUpdatingShare && <Loader2 size={16} className="spin" style={{ alignSelf: "center" }} />}
        </div>

        <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
          {collection.visibility === "private" &&
            "Private collections are only visible in the CMS. Switch to Unlisted to create a secret link."}
          {collection.visibility === "unlisted" &&
            "Anyone with the link can view this collection. Regenerate the token to revoke old links."}
          {collection.visibility === "public" &&
            "This collection is publicly listed and indexable. Anyone with the link can view it."}
        </div>

        {sharePath ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              padding: "9px 12px",
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border-color)",
              borderRadius: "5px",
            }}
          >
            <code style={{ flex: 1, minWidth: "220px", fontSize: "11px", color: "var(--accent-color)", wordBreak: "break-all" }}>
              {shareUrl}
            </code>
            <button type="button" className="btn btn-sm" onClick={() => copyShareLink()}>
              <Copy size={12} /> Copy
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleRegenerate}
              disabled={isUpdatingShare}
              title="Generate a new token and revoke the old link"
              style={{ display: collection.visibility === "unlisted" ? "inline-flex" : "none", alignItems: "center", gap: "4px" }}
            >
              <RefreshCw size={12} /> Regenerate
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => handleVisibility("unlisted")}
            disabled={isUpdatingShare}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", width: "fit-content" }}
          >
            <Eye size={13} /> Create share link
          </button>
        )}
      </div>

      {showPhotos && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>
              Photos <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({photos.length})</span>
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setIsPickerOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
            >
              <Plus size={13} /> Add Photos
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="card" style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No photos in this collection yet.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "10px" }}>
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="card"
                  style={{ position: "relative", padding: 0, overflow: "hidden" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 8px",
                      borderTop: "1px solid var(--border-color)",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                      title={photo.title}
                    >
                      {photo.title}
                    </span>
                    {photo.visibility === "private" && (
                      <span className="badge" style={{ fontSize: "9px" }}>
                        Private
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-icon btn-danger"
                      onClick={() => handleRemovePhoto(photo.id)}
                      title="Remove from collection"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {showMedia && totalMedia > 0 && (
        <section>
          <h2 style={{ margin: "0 0 10px", fontSize: "15px", fontWeight: 700 }}>
            Media <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({totalMedia})</span>
          </h2>

          {movies.length > 0 && (
            <MediaGroup
              title="Films"
              icon={<Film size={14} />}
              items={movies.map((movie) => ({
                id: movie.id,
                type: "movie",
                title: movie.title,
                subtitle: movie.year ? String(movie.year) : null,
                imageUrl: movie.posterUrl,
                favorite: movie.favorite,
                rating: movie.rating,
                visibility: movie.visibility,
              }))}
              onRemove={handleRemoveMedia}
            />
          )}

          {shows.length > 0 && (
            <MediaGroup
              title="TV Shows"
              icon={<Tv size={14} />}
              items={shows.map((show) => ({
                id: show.id,
                type: "show",
                title: show.title,
                subtitle: show.year ? String(show.year) : show.status,
                imageUrl: show.posterUrl,
                favorite: show.favorite,
                rating: show.rating,
                visibility: show.visibility,
              }))}
              onRemove={handleRemoveMedia}
            />
          )}

          {artists.length > 0 && (
            <MediaGroup
              title="Artists"
              icon={<Users size={14} />}
              items={artists.map((artist) => ({
                id: artist.id,
                type: "artist",
                title: artist.name,
                subtitle: `${artist.playCount.toLocaleString()} plays`,
                imageUrl: null,
                favorite: artist.favorite,
                rating: artist.rating,
                visibility: artist.visibility,
              }))}
              onRemove={handleRemoveMedia}
            />
          )}

          {albums.length > 0 && (
            <MediaGroup
              title="Albums"
              icon={<Music size={14} />}
              items={albums.map((album) => ({
                id: album.id,
                type: "album",
                title: album.name,
                subtitle: `${album.artist} · ${album.playCount.toLocaleString()} plays`,
                imageUrl: null,
                favorite: album.favorite,
                rating: album.rating,
                visibility: album.visibility,
              }))}
              onRemove={handleRemoveMedia}
            />
          )}

          {tracks.length > 0 && (
            <MediaGroup
              title="Tracks"
              icon={<Music size={14} />}
              items={tracks.map((track) => ({
                id: track.id,
                type: "track",
                title: track.name,
                subtitle: `${track.artist} · ${track.playCount.toLocaleString()} plays`,
                imageUrl: null,
                favorite: track.favorite,
                rating: track.rating,
                visibility: track.visibility,
              }))}
              onRemove={handleRemoveMedia}
            />
          )}

          {people.length > 0 && (
            <MediaGroup
              title="People"
              icon={<Users size={14} />}
              items={people.map((person) => ({
                id: person.id,
                type: "person",
                title: person.name,
                subtitle: null,
                imageUrl: person.avatarUrl,
                favorite: false,
                rating: null,
                visibility: person.visibility,
              }))}
              onRemove={handleRemoveMedia}
            />
          )}

          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
            Movies, shows, artists, albums, tracks, and people are added from their own detail pages. Remove them here
            at any time.
          </p>
        </section>
      )}

      {/* Collection settings */}
      <form className="card" onSubmit={handleSaveMetadata} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Collection Settings</h2>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
          <div>
            <label className="label">Name</label>
            <input className="text-input" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="text-input"
              value={kind}
              onChange={(event) => setKind(event.target.value as CollectionKind)}
            >
              <option value="photo">Photo album</option>
              <option value="media">Media collection</option>
              <option value="mixed">Mixed collection</option>
            </select>
          </div>
          <div>
            <label className="label">Color</label>
            <input
              type="color"
              className="text-input"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              style={{ padding: "2px", height: "38px" }}
            />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="text-input"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Shown on the public collection page"
          />
        </div>

        <div>
          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={isSaving}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
          >
            {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>

      <CollectionPhotoPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        collectionName={collection.name}
        existingPhotoIds={photos.map((photo) => photo.id)}
        onAdd={handleAddPhotos}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}

interface MediaGroupItem {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  favorite: boolean;
  rating: number | null;
  visibility: string;
}

function MediaGroup({
  title,
  icon,
  items,
  onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  items: MediaGroupItem[];
  onRemove: (type: string, id: string) => void;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "7px",
          color: "var(--text-muted)",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {icon} {title} ({items.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "8px" }}>
        {items.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: "9px", padding: "8px 9px" }}
          >
            <div
              style={{
                display: "grid",
                placeItems: "center",
                width: "36px",
                height: "36px",
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: "5px",
                background: "var(--bg-sidebar)",
                color: "var(--text-muted)",
              }}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <ImageIcon size={15} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
                title={item.title}
              >
                {item.title}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "10px",
                  color: "var(--text-muted)",
                }}
              >
                {item.subtitle && <span>{item.subtitle}</span>}
                {item.favorite && <Heart size={10} fill="currentColor" style={{ color: "var(--accent-color)" }} />}
                {item.rating != null && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", color: "#fbbf24" }}>
                    <Star size={10} fill="currentColor" /> {item.rating}
                  </span>
                )}
                {item.visibility === "private" && <span className="badge" style={{ fontSize: "8px" }}>Private</span>}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-icon btn-danger"
              onClick={() => onRemove(item.type, item.id)}
              title="Remove from collection"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
