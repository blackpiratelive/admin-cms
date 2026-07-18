"use client";

import React, { useState } from "react";
import { type GalleryPhoto, type LocationRecord, type TripRecord } from "@/db/schema";
import { deleteGalleryPhoto, saveGalleryPhoto } from "./actions";
import { notify } from "@/lib/notifications";
import { generatePhotoSlug } from "./schema";
import { getLocations } from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import {
  Trash2,
  Camera,
  Edit3,
  Check,
  X,
  Sparkles,
  MapPin,
  Compass,
  Loader2,
  Globe,
} from "lucide-react";

interface GalleryGridProps {
  initialPhotos: GalleryPhoto[];
  onRefresh?: () => void;
}

export function GalleryGrid({ initialPhotos, onRefresh }: GalleryGridProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState("all");

  const [locationsList, setLocationsList] = useState<LocationRecord[]>([]);
  const [tripsList, setTripsList] = useState<TripRecord[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);

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

  // Form state for editing existing photo
  const [editForm, setEditForm] = useState({
    title: "",
    slug: "",
    description: "",
    album: "",
    tags: "",
    visibility: "public" as "public" | "private" | "unlisted",
    featured: false,
    camera: "",
    lens: "",
    focalLength: "",
    aperture: "",
    shutterSpeed: "",
    iso: "",
    takenAt: "",
    latitude: "",
    longitude: "",
    locationName: "",
    locationId: "",
    tripId: "",
    shortUrl: "",
    shortSlug: "",
  });

  const filteredPhotos = photos.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      (p.camera && p.camera.toLowerCase().includes(search.toLowerCase())) ||
      (p.locationName && p.locationName.toLowerCase().includes(search.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

    const matchesAlbum = albumFilter === "all" || p.album === albumFilter;
    return matchesSearch && matchesAlbum;
  });

  const albums = Array.from(new Set(photos.map((p) => p.album).filter(Boolean)));

  const handleOpenEdit = (photo: GalleryPhoto) => {
    let tagsStr = "";
    try {
      const parsed = JSON.parse(photo.tags);
      if (Array.isArray(parsed)) tagsStr = parsed.join(", ");
    } catch {
      tagsStr = photo.tags || "";
    }

    loadEntities();
    setEditingPhoto(photo);
    setEditForm({
      title: photo.title,
      slug: photo.slug,
      description: photo.description || "",
      album: photo.album || "",
      tags: tagsStr,
      visibility: (photo.visibility as any) || "public",
      featured: photo.featured === 1,
      camera: photo.camera || "",
      lens: photo.lens || "",
      focalLength: photo.focalLength || "",
      aperture: photo.aperture || "",
      shutterSpeed: photo.shutterSpeed || "",
      iso: photo.iso ? String(photo.iso) : "",
      takenAt: photo.takenAt || "",
      latitude: photo.latitude ? String(photo.latitude) : "",
      longitude: photo.longitude ? String(photo.longitude) : "",
      locationName: photo.locationName || "",
      locationId: photo.locationId || "",
      tripId: photo.tripId || "",
      shortUrl: photo.shortUrl || "",
      shortSlug: "",
    });
  };

  const [isPhotoShortening, setIsPhotoShortening] = useState(false);
  const [photoCopiedShortUrl, setPhotoCopiedShortUrl] = useState(false);

  const handleGeneratePhotoShortLink = async () => {
    if (!editingPhoto) return;
    setIsPhotoShortening(true);
    try {
      const { createShortLink } = await import("@/features/links/actions");
      const currentHost = typeof window !== "undefined" ? window.location.host : "admin.blackpiratex.com";
      const publicPhotoUrl = `https://${currentHost}/gallery/${editForm.slug || editingPhoto.slug}`;

      const res = await createShortLink({
        url: publicPhotoUrl,
        slug: editForm.shortSlug.trim() || undefined,
      });

      if (res.success && res.shortUrl) {
        setEditForm((prev) => ({ ...prev, shortUrl: res.shortUrl }));

        // Auto-save generated shortUrl into the CMS Database immediately
        const tagsArray = editForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

        const saveRes = await saveGalleryPhoto({
          id: editingPhoto.id,
          title: editForm.title,
          slug: editForm.slug || generatePhotoSlug(editForm.title),
          description: editForm.description || null,
          originalUrl: editingPhoto.originalUrl,
          largeUrl: editingPhoto.largeUrl,
          mediumUrl: editingPhoto.mediumUrl,
          thumbnailUrl: editingPhoto.thumbnailUrl,
          width: editingPhoto.width,
          height: editingPhoto.height,
          fileSize: editingPhoto.fileSize,
          mimeType: editingPhoto.mimeType,
          camera: editForm.camera || null,
          lens: editForm.lens || null,
          focalLength: editForm.focalLength || null,
          aperture: editForm.aperture || null,
          shutterSpeed: editForm.shutterSpeed || null,
          iso: editForm.iso ? Number(editForm.iso) : null,
          takenAt: editForm.takenAt || null,
          latitude: editForm.latitude ? Number(editForm.latitude) : null,
          longitude: editForm.longitude ? Number(editForm.longitude) : null,
          locationName: editForm.locationName || null,
          visibility: editForm.visibility,
          featured: editForm.featured,
          processingStatus: editingPhoto.processingStatus as any,
          tags: tagsArray,
          album: editForm.album || null,
          shortUrl: res.shortUrl,
        });

        if (saveRes.success) {
          const updatedRecord: GalleryPhoto = {
            ...editingPhoto,
            shortUrl: res.shortUrl,
          };
          setPhotos((prev) =>
            prev.map((p) => (p.id === editingPhoto.id ? { ...p, shortUrl: res.shortUrl } : p))
          );
          if (selectedPhoto?.id === editingPhoto.id) {
            setSelectedPhoto((prev) => (prev ? { ...prev, shortUrl: res.shortUrl } : null));
          }
        }
      } else {
        alert(res.error || "Failed to generate short link.");
      }
    } catch (err: any) {
      alert("Error generating short URL: " + (err.message || String(err)));
    } finally {
      setIsPhotoShortening(false);
    }
  };

  const handleDeletePhotoShortLink = async () => {
    if (!editingPhoto || !editForm.shortUrl) return;
    if (!confirm("Delete this short URL from RapidLink API and revoke public share link?")) return;

    setIsPhotoShortening(true);
    try {
      const { deleteShortLink } = await import("@/features/links/actions");
      const urlSlug = editForm.shortUrl.split("/").filter(Boolean).pop();
      if (urlSlug) {
        await deleteShortLink(urlSlug);
      }

      setEditForm((prev) => ({ ...prev, shortUrl: "", shortSlug: "" }));

      const tagsArray = editForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await saveGalleryPhoto({
        id: editingPhoto.id,
        title: editForm.title,
        slug: editForm.slug || generatePhotoSlug(editForm.title),
        description: editForm.description || null,
        originalUrl: editingPhoto.originalUrl,
        largeUrl: editingPhoto.largeUrl,
        mediumUrl: editingPhoto.mediumUrl,
        thumbnailUrl: editingPhoto.thumbnailUrl,
        width: editingPhoto.width,
        height: editingPhoto.height,
        fileSize: editingPhoto.fileSize,
        mimeType: editingPhoto.mimeType,
        camera: editForm.camera || null,
        lens: editForm.lens || null,
        focalLength: editForm.focalLength || null,
        aperture: editForm.aperture || null,
        shutterSpeed: editForm.shutterSpeed || null,
        iso: editForm.iso ? Number(editForm.iso) : null,
        takenAt: editForm.takenAt || null,
        latitude: editForm.latitude ? Number(editForm.latitude) : null,
        longitude: editForm.longitude ? Number(editForm.longitude) : null,
        locationName: editForm.locationName || null,
        visibility: editForm.visibility,
        featured: editForm.featured,
        processingStatus: editingPhoto.processingStatus as any,
        tags: tagsArray,
        album: editForm.album || null,
        shortUrl: null,
      });

      setPhotos((prev) =>
        prev.map((p) => (p.id === editingPhoto.id ? { ...p, shortUrl: null } : p))
      );
      if (selectedPhoto?.id === editingPhoto.id) {
        setSelectedPhoto((prev) => (prev ? { ...prev, shortUrl: null } : null));
      }
    } catch (err: any) {
      alert("Error deleting short link: " + (err.message || String(err)));
    } finally {
      setIsPhotoShortening(false);
    }
  };

  const handleCopyPhotoShortUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setPhotoCopiedShortUrl(true);
    setTimeout(() => setPhotoCopiedShortUrl(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto) return;

    const currentPhoto = editingPhoto;
    const currentForm = { ...editForm };
    const tagsArray = currentForm.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updatedPhotoRecord: GalleryPhoto = {
      ...currentPhoto,
      title: currentForm.title,
      slug: currentForm.slug,
      description: currentForm.description || null,
      album: currentForm.album || null,
      tags: JSON.stringify(tagsArray),
      visibility: currentForm.visibility,
      featured: currentForm.featured ? 1 : 0,
      camera: currentForm.camera || null,
      lens: currentForm.lens || null,
      focalLength: currentForm.focalLength || null,
      aperture: currentForm.aperture || null,
      shutterSpeed: currentForm.shutterSpeed || null,
      iso: currentForm.iso ? Number(currentForm.iso) : null,
      takenAt: currentForm.takenAt || null,
      latitude: currentForm.latitude ? Number(currentForm.latitude) : null,
      longitude: currentForm.longitude ? Number(currentForm.longitude) : null,
      locationName: currentForm.locationName || null,
      locationId: currentForm.locationId || null,
      tripId: currentForm.tripId || null,
      shortUrl: currentForm.shortUrl || null,
    };

    setPhotos((prev) =>
      prev.map((p) => (p.id === currentPhoto.id ? updatedPhotoRecord : p))
    );
    if (selectedPhoto?.id === currentPhoto.id) {
      setSelectedPhoto(updatedPhotoRecord);
    }
    setEditingPhoto(null);

    notify.bg({
      title: "Save Photo Metadata",
      loadingMessage: `Saving photo '${currentForm.title}' in background...`,
      successMessage: `Photo '${currentForm.title}' saved successfully!`,
      errorMessage: (err) => `Failed to save photo: ${err?.message || String(err)}`,
      task: () =>
        saveGalleryPhoto({
          id: currentPhoto.id,
          title: currentForm.title,
          slug: currentForm.slug || generatePhotoSlug(currentForm.title),
          description: currentForm.description || null,
          originalUrl: currentPhoto.originalUrl,
          largeUrl: currentPhoto.largeUrl,
          mediumUrl: currentPhoto.mediumUrl,
          thumbnailUrl: currentPhoto.thumbnailUrl,
          width: currentPhoto.width,
          height: currentPhoto.height,
          fileSize: currentPhoto.fileSize,
          mimeType: currentPhoto.mimeType,
          camera: currentForm.camera || null,
          lens: currentForm.lens || null,
          focalLength: currentForm.focalLength || null,
          aperture: currentForm.aperture || null,
          shutterSpeed: currentForm.shutterSpeed || null,
          iso: currentForm.iso ? Number(currentForm.iso) : null,
          takenAt: currentForm.takenAt || null,
          latitude: currentForm.latitude ? Number(currentForm.latitude) : null,
          longitude: currentForm.longitude ? Number(currentForm.longitude) : null,
          locationName: currentForm.locationName || null,
          locationId: currentForm.locationId || null,
          tripId: currentForm.tripId || null,
          visibility: currentForm.visibility,
          featured: currentForm.featured,
          processingStatus: currentPhoto.processingStatus as any,
          tags: tagsArray,
          album: currentForm.album || null,
          shortUrl: currentForm.shortUrl || null,
        }),
      onSuccess: () => {
        if (onRefresh) onRefresh();
      },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Permanently delete this photo entry from the gallery?")) return;
    const target = photos.find((p) => p.id === id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (selectedPhoto?.id === id) {
      setSelectedPhoto(null);
    }

    notify.bg({
      title: "Delete Photo",
      loadingMessage: `Deleting photo ${target?.title ? `'${target.title}' ` : ""}...`,
      successMessage: `Photo deleted.`,
      errorMessage: "Failed to delete photo.",
      task: () => deleteGalleryPhoto(id),
      onSuccess: () => {
        if (onRefresh) onRefresh();
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search photo titles, cameras, locations, descriptions, slugs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
            style={{ width: "100%" }}
          />
        </div>

        <select
          value={albumFilter}
          onChange={(e) => setAlbumFilter(e.target.value)}
          className="select-input"
        >
          <option value="all">All Albums ({photos.length})</option>
          {albums.map((alb) => (
            <option key={alb!} value={alb!}>
              {alb}
            </option>
          ))}
        </select>
      </div>

      {/* Grid Display */}
      {filteredPhotos.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--text-muted)",
          }}
        >
          No photos found in the gallery repository. Upload some photos above!
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredPhotos.map((photo) => {
            return (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  transition: "transform 0.15s ease",
                }}
              >
                <div style={{ position: "relative", width: "100%", height: "180px", background: "#000" }}>
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <span
                    className={`status-badge status-${photo.visibility === "public" ? "published" : "draft"}`}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                    }}
                  >
                    {photo.visibility}
                  </span>
                  {photo.featured === 1 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        background: "var(--accent)",
                        color: "var(--accent-text)",
                        fontSize: "10px",
                        fontWeight: "bold",
                        padding: "2px 6px",
                        borderRadius: "2px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Sparkles size={10} /> Featured
                    </span>
                  )}
                </div>

                <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {photo.title}
                  </div>

                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    /{photo.slug}
                  </div>

                  {photo.camera && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                      <Camera size={12} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {photo.camera} {photo.lens ? `• ${photo.lens}` : ""}
                      </span>
                    </div>
                  )}

                  {photo.locationName && (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={11} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {photo.locationName}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "8px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {photo.width && photo.height ? `${photo.width} × ${photo.height}` : ""}
                    </span>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(photo);
                        }}
                        className="btn btn-sm"
                        title="Edit photo metadata"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo.id);
                        }}
                        className="btn btn-sm btn-danger"
                        title="Delete photo"
                        disabled={deletingId === photo.id}
                      >
                        {deletingId === photo.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && !editingPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", background: "#000", textAlign: "center" }}>
              <img
                src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
                alt={selectedPhoto.title}
                style={{ maxHeight: "60vh", maxWidth: "100%", objectFit: "contain" }}
              />
              <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEdit(selectedPhoto);
                  }}
                  className="btn btn-sm"
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(null)}
                  className="btn btn-sm"
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "bold" }}>{selectedPhoto.title}</h2>
              {selectedPhoto.description && (
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{selectedPhoto.description}</p>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", background: "var(--bg-sidebar)", padding: "12px", borderRadius: "4px" }}>
                <div>
                  <strong>Camera:</strong> {selectedPhoto.camera || "N/A"} <br />
                  <strong>Lens:</strong> {selectedPhoto.lens || "N/A"} <br />
                  <strong>Focal Length:</strong> {selectedPhoto.focalLength || "N/A"}
                </div>
                <div>
                  <strong>Aperture:</strong> {selectedPhoto.aperture || "N/A"} <br />
                  <strong>Shutter:</strong> {selectedPhoto.shutterSpeed || "N/A"} <br />
                  <strong>ISO:</strong> {selectedPhoto.iso || "N/A"}
                </div>
              </div>

              {(selectedPhoto.locationName || selectedPhoto.latitude || selectedPhoto.longitude) && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-secondary)" }}>
                  <MapPin size={14} style={{ color: "var(--accent)" }} />
                  <span>
                    <strong>Location:</strong> {selectedPhoto.locationName || "N/A"}
                    {selectedPhoto.latitude && selectedPhoto.longitude
                      ? ` (${selectedPhoto.latitude}, ${selectedPhoto.longitude})`
                      : ""}
                  </span>
                </div>
              )}

              {selectedPhoto.shortUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", background: "var(--bg-sidebar)", padding: "8px 12px", borderRadius: "4px" }}>
                  <Globe size={14} style={{ color: "var(--accent)" }} />
                  <span>
                    <strong>RapidLink Short URL:</strong>{" "}
                    <code style={{ color: "var(--accent)", fontWeight: "bold" }}>{selectedPhoto.shortUrl}</code>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleCopyPhotoShortUrl(selectedPhoto.shortUrl!)}
                    style={{ marginLeft: "auto", padding: "2px 8px" }}
                  >
                    {photoCopiedShortUrl ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Edit Modal */}
      {editingPhoto && (
        <div
          onClick={() => setEditingPhoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
            zIndex: 1010,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "4px",
              maxWidth: "850px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "bold" }}>Edit Photo: {editingPhoto.title}</h3>
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="btn btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <div className="gallery-form-grid">
              {/* General Metadata */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                <h4 style={{ fontSize: "13px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                  General Information
                </h4>

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="text-input"
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                        slug: generatePhotoSlug(e.target.value),
                      }))
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input
                    type="text"
                    className="text-input"
                    value={editForm.slug}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="text-input"
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", minWidth: 0 }}>
                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Album / Collection</label>
                    <input
                      type="text"
                      className="text-input"
                      value={editForm.album}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, album: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Tags (comma separated)</label>
                    <input
                      type="text"
                      className="text-input"
                      value={editForm.tags}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                    <input
                      type="checkbox"
                      checked={editForm.featured}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, featured: e.target.checked }))}
                    />
                    <span>Featured Photo</span>
                  </label>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="form-label">Visibility:</span>
                    <select
                      className="select-input"
                      value={editForm.visibility}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, visibility: e.target.value as any }))}
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                      <option value="unlisted">Unlisted (Shareable Short Link)</option>
                    </select>
                  </div>
                </div>

                {/* RapidLink Short URL for Photo / Unlisted Sharing */}
                <div style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "4px", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Globe size={13} style={{ color: "var(--accent)" }} /> Shareable Short URL
                    </span>
                    {editForm.shortUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <code style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "bold" }}>
                          {editForm.shortUrl}
                        </code>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleCopyPhotoShortUrl(editForm.shortUrl)}
                          style={{ padding: "1px 6px" }}
                        >
                          {photoCopiedShortUrl ? "Copied!" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={handleDeletePhotoShortLink}
                          disabled={isPhotoShortening}
                          style={{ padding: "1px 6px" }}
                          title="Delete short link from RapidLink API & remove public share access"
                        >
                          Delete Link
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      className="text-input"
                      style={{ flex: 1, fontSize: "11px" }}
                      placeholder="Custom slug (optional)..."
                      value={editForm.shortSlug}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, shortSlug: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleGeneratePhotoShortLink}
                      disabled={isPhotoShortening}
                    >
                      {isPhotoShortening ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                      <span>{isPhotoShortening ? "Generating..." : editForm.shortUrl ? "Regenerate" : "Shorten URL"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Technical EXIF & Location */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                <h4 style={{ fontSize: "13px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                  Technical & Camera EXIF
                </h4>

                <div className="form-group">
                  <label className="form-label">Camera</label>
                  <input
                    type="text"
                    className="text-input"
                    value={editForm.camera}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, camera: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Lens</label>
                  <input
                    type="text"
                    className="text-input"
                    value={editForm.lens}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, lens: e.target.value }))}
                  />
                </div>

                <div className="gallery-technical-grid">
                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Focal</label>
                    <input
                      type="text"
                      className="text-input"
                      value={editForm.focalLength}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, focalLength: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Aperture</label>
                    <input
                      type="text"
                      className="text-input"
                      value={editForm.aperture}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, aperture: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Shutter</label>
                    <input
                      type="text"
                      className="text-input"
                      value={editForm.shutterSpeed}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, shutterSpeed: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">ISO</label>
                    <input
                      type="text"
                      className="text-input"
                      value={editForm.iso}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, iso: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Capture Date</label>
                  <input
                    type="text"
                    className="text-input"
                    value={editForm.takenAt}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, takenAt: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MapPin size={13} style={{ color: "var(--accent)" }} />
                    <span>Associated Location</span>
                    {isLoadingEntities && <Loader2 size={12} className="animate-spin" />}
                  </label>
                  <select
                    className="select-input"
                    value={editForm.locationId}
                    onFocus={loadEntities}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const foundLoc = locationsList.find((l) => l.id === selectedId);
                      setEditForm((prev) => ({
                        ...prev,
                        locationId: selectedId,
                        locationName: foundLoc ? foundLoc.name : "",
                        latitude: foundLoc && foundLoc.latitude ? String(foundLoc.latitude) : prev.latitude,
                        longitude: foundLoc && foundLoc.longitude ? String(foundLoc.longitude) : prev.longitude,
                      }));
                    }}
                  >
                    <option value="">-- None (No Location) --</option>
                    {locationsList.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {[loc.city, loc.country].filter(Boolean).length ? `(${[loc.city, loc.country].filter(Boolean).join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Compass size={13} style={{ color: "var(--accent)" }} />
                    <span>Associated Trip</span>
                    {isLoadingEntities && <Loader2 size={12} className="animate-spin" />}
                  </label>
                  <select
                    className="select-input"
                    value={editForm.tripId}
                    onFocus={loadEntities}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, tripId: e.target.value }))}
                  >
                    <option value="">-- None (No Trip) --</option>
                    {tripsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", minWidth: 0 }}>
                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Latitude</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="19.8135"
                      value={editForm.latitude}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, latitude: e.target.value }))}
                    />
                  </div>

                  <div className="form-group" style={{ minWidth: 0 }}>
                    <label className="form-label">Longitude</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="85.8312"
                      value={editForm.longitude}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, longitude: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="btn"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

