"use client";

import React, { useState } from "react";
import { type GalleryPhoto } from "@/db/schema";
import { deleteGalleryPhoto } from "./actions";
import { Trash2, Camera, Eye, MapPin, Tag, Calendar, Sparkles, AlertCircle } from "lucide-react";

interface GalleryGridProps {
  initialPhotos: GalleryPhoto[];
  onRefresh?: () => void;
}

export function GalleryGrid({ initialPhotos, onRefresh }: GalleryGridProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState("all");

  const filteredPhotos = photos.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      (p.camera && p.camera.toLowerCase().includes(search.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

    const matchesAlbum = albumFilter === "all" || p.album === albumFilter;
    return matchesSearch && matchesAlbum;
  });

  const albums = Array.from(new Set(photos.map((p) => p.album).filter(Boolean)));

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this photo entry from the gallery?")) return;
    const res = await deleteGalleryPhoto(id);
    if (res.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (selectedPhoto?.id === id) setSelectedPhoto(null);
      if (onRefresh) onRefresh();
    } else {
      alert(res.error || "Failed to delete photo.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search photo titles, cameras, descriptions, slugs..."
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

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: "8px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {photo.width && photo.height ? `${photo.width} × ${photo.height}` : ""}
                    </span>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo.id);
                        }}
                        className="btn btn-sm btn-danger"
                        title="Delete photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Lightbox / Metadata Preview Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
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
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="btn btn-sm"
                style={{ position: "absolute", top: "12px", right: "12px" }}
              >
                Close
              </button>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
