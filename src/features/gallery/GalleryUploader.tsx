"use client";

import React, { useState, useRef, useCallback } from "react";
import { processImageWithWorker, type ProcessedDerivatives } from "./worker/imageWorker";
import { extractExifMetadata, type ExtractedExif } from "./exif";
import { getPresignedGalleryUrls, saveGalleryPhoto, type PresignedUrlsResult } from "./actions";
import { generatePhotoSlug } from "./schema";
import { LocationRecord, TripRecord } from "@/db/schema";
import { getLocations } from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import {
  UploadCloud,
  X,
  Check,
  AlertCircle,
  Camera,
  Calendar,
  MapPin,
  Compass,
  RefreshCw,
  FileImage,
  Tag,
  FolderPlus,
  Eye,
  Info,
  Sliders,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react";

export type UploadStatus =
  | "IDLE"
  | "EXTRACTING_EXIF"
  | "PROCESSING_WORKER"
  | "REQUESTING_URLS"
  | "UPLOADING_THUMBNAIL"
  | "THUMBNAIL_READY"
  | "UPLOADING_MEDIUM"
  | "UPLOADING_LARGE"
  | "UPLOADING_ORIGINAL"
  | "UPLOADS_COMPLETE"
  | "SAVING_METADATA"
  | "SAVED"
  | "ERROR";

export interface GalleryQueueItem {
  id: string;
  file: File;
  title: string;
  slug: string;
  status: UploadStatus;
  progress: number; // 0 to 100
  statusText: string;
  exif: ExtractedExif;
  derivatives?: ProcessedDerivatives;
  urlsResult?: PresignedUrlsResult;
  previewUrl?: string; // Thumbnail preview URL (or object URL fallback)
  error?: string;
  abortController?: AbortController;
  // Form fields
  form: {
    title: string;
    slug: string;
    description: string;
    album: string;
    tags: string;
    visibility: "public" | "private" | "unlisted";
    featured: boolean;
    camera: string;
    lens: string;
    focalLength: string;
    aperture: string;
    shutterSpeed: string;
    iso: string;
    takenAt: string;
    latitude: string;
    longitude: string;
    locationName: string;
    locationId: string;
    tripId: string;
  };
}

interface GalleryUploaderProps {
  onUploadSuccess?: () => void;
}

export function GalleryUploader({ onUploadSuccess }: GalleryUploaderProps) {
  const [queue, setQueue] = useState<GalleryQueueItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, updater: (prev: GalleryQueueItem) => GalleryQueueItem) => {
    setQueue((prevQueue) => prevQueue.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  // Process single queue item through the exact pipeline
  const processQueueItem = async (itemId: string, file: File) => {
    const abortController = new AbortController();

    // Helper to upload blob via PUT request with progress
    const uploadBlob = async (uploadUrl: string, blob: Blob, contentType: string, onProgress?: (pct: number) => void) => {
      return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", contentType);

        if (onProgress && xhr.upload) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status code ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during file upload"));
        xhr.onabort = () => reject(new Error("Upload cancelled by user"));

        abortController.signal.addEventListener("abort", () => {
          xhr.abort();
        });

        xhr.send(blob);
      });
    };

    try {
      updateItem(itemId, (item) => ({
        ...item,
        status: "EXTRACTING_EXIF",
        progress: 5,
        statusText: "Extracting EXIF metadata...",
        abortController,
      }));

      // 1. Extract EXIF metadata
      const exif = await extractExifMetadata(file);
      const initialTitle = file.name.replace(/\.[^/.]+$/, "");
      const initialSlug = generatePhotoSlug(file.name);

      updateItem(itemId, (item) => ({
        ...item,
        exif,
        form: {
          ...item.form,
          title: item.form.title || initialTitle,
          slug: item.form.slug || initialSlug,
          camera: exif.camera || "",
          lens: exif.lens || "",
          focalLength: exif.focalLength || "",
          aperture: exif.aperture || "",
          shutterSpeed: exif.shutterSpeed || "",
          iso: exif.iso ? String(exif.iso) : "",
          takenAt: exif.takenAt || "",
          latitude: exif.latitude ? String(exif.latitude) : "",
          longitude: exif.longitude ? String(exif.longitude) : "",
        },
        status: "PROCESSING_WORKER",
        progress: 15,
        statusText: "Processing image in Web Worker...",
      }));

      // 2. Spawn Web Worker to process image derivatives
      const derivatives = await processImageWithWorker(itemId, file, (msg) => {
        let pct = 15;
        if (msg.stage === "DECODING") pct = 20;
        if (msg.stage === "GENERATING_THUMBNAIL") pct = 30;
        if (msg.stage === "GENERATING_MEDIUM") pct = 45;
        if (msg.stage === "GENERATING_LARGE") pct = 60;
        updateItem(itemId, (item) => ({
          ...item,
          progress: pct,
          statusText: `Worker: ${msg.stage.replace(/_/g, " ").toLowerCase()}...`,
        }));
      });

      updateItem(itemId, (item) => ({
        ...item,
        derivatives,
        status: "REQUESTING_URLS",
        progress: 65,
        statusText: "Requesting signed Cloudflare R2 upload URLs...",
      }));

      // 3. Request presigned upload URLs from server
      const ext = file.name.split(".").pop() || "jpg";
      const urlsRes = await getPresignedGalleryUrls({
        folderSlug: initialSlug,
        originalExtension: ext,
      });

      if (!urlsRes.success || !urlsRes.data) {
        throw new Error(urlsRes.error || "Failed to obtain upload URLs from server.");
      }

      const urlsResult = urlsRes.data;

      // 4. Upload Thumbnail FIRST
      updateItem(itemId, (item) => ({
        ...item,
        urlsResult,
        status: "UPLOADING_THUMBNAIL",
        progress: 70,
        statusText: "Uploading Thumbnail (1/4)...",
      }));

      await uploadBlob(urlsResult.urls.thumbnail.uploadUrl, derivatives.thumbnailBlob, "image/webp", (pct) => {
        updateItem(itemId, (item) => ({
          ...item,
          progress: 70 + Math.round(pct * 0.05),
        }));
      });

      // Immediately display thumbnail preview in UI!
      const previewUrl = urlsResult.urls.thumbnail.publicUrl || URL.createObjectURL(derivatives.thumbnailBlob);
      updateItem(itemId, (item) => ({
        ...item,
        previewUrl,
        status: "THUMBNAIL_READY",
        progress: 75,
        statusText: "Thumbnail ready! Uploading Medium (2/4)...",
      }));

      // 5. Upload Medium
      updateItem(itemId, (item) => ({ ...item, status: "UPLOADING_MEDIUM" }));
      await uploadBlob(urlsResult.urls.medium.uploadUrl, derivatives.mediumBlob, "image/webp", (pct) => {
        updateItem(itemId, (item) => ({
          ...item,
          progress: 75 + Math.round(pct * 0.08),
        }));
      });

      // 6. Upload Large
      updateItem(itemId, (item) => ({
        ...item,
        status: "UPLOADING_LARGE",
        statusText: "Uploading Large (3/4)...",
      }));
      await uploadBlob(urlsResult.urls.large.uploadUrl, derivatives.largeBlob, "image/webp", (pct) => {
        updateItem(itemId, (item) => ({
          ...item,
          progress: 83 + Math.round(pct * 0.08),
        }));
      });

      // 7. Upload Original
      updateItem(itemId, (item) => ({
        ...item,
        status: "UPLOADING_ORIGINAL",
        statusText: "Uploading Original file (4/4)...",
      }));
      await uploadBlob(urlsResult.urls.original.uploadUrl, derivatives.originalBlob, file.type || "image/jpeg", (pct) => {
        updateItem(itemId, (item) => ({
          ...item,
          progress: 91 + Math.round(pct * 0.08),
        }));
      });

      updateItem(itemId, (item) => ({
        ...item,
        status: "UPLOADS_COMPLETE",
        progress: 100,
        statusText: "All files uploaded to R2. Ready to save metadata.",
      }));
    } catch (err: any) {
      if (err.message === "Upload cancelled by user") {
        updateItem(itemId, (item) => ({
          ...item,
          status: "ERROR",
          statusText: "Cancelled by user.",
          error: "Upload cancelled.",
        }));
      } else {
        console.error("Upload pipeline error:", err);
        updateItem(itemId, (item) => ({
          ...item,
          status: "ERROR",
          statusText: "Pipeline error occurred.",
          error: err.message || "An error occurred during upload.",
        }));
      }
    }
  };

  const addFilesToQueue = (files: FileList | File[]) => {
    const fileList = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileList.length === 0) return;

    const newItems: GalleryQueueItem[] = fileList.map((file) => {
      const id = crypto.randomUUID();
      const initialTitle = file.name.replace(/\.[^/.]+$/, "");
      const initialSlug = generatePhotoSlug(file.name);

      return {
        id,
        file,
        title: initialTitle,
        slug: initialSlug,
        status: "IDLE",
        progress: 0,
        statusText: "Pending...",
        exif: {},
        previewUrl: URL.createObjectURL(file),
        form: {
          title: initialTitle,
          slug: initialSlug,
          description: "",
          album: "",
          tags: "",
          visibility: "public",
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
        },
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    if (!activeItemId && newItems.length > 0) {
      setActiveItemId(newItems[0].id);
    }

    // Trigger pipeline execution for newly added files sequentially or in limited parallel batches
    for (const newItem of newItems) {
      processQueueItem(newItem.id, newItem.file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      addFilesToQueue(e.clipboardData.files);
    }
  }, []);

  const handleCancelItem = (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (item?.abortController) {
      item.abortController.abort();
    } else {
      updateItem(id, (prev) => ({
        ...prev,
        status: "ERROR",
        statusText: "Cancelled.",
        error: "Cancelled.",
      }));
    }
  };

  const handleRemoveItem = (id: string) => {
    handleCancelItem(id);
    setQueue((prev) => prev.filter((i) => i.id !== id));
    if (activeItemId === id) {
      const remaining = queue.filter((i) => i.id !== id);
      setActiveItemId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleRetryItem = (id: string) => {
    const item = queue.find((i) => i.id === id);
    if (item) {
      processQueueItem(id, item.file);
    }
  };

  // Final confirmation and saving to Turso database
  const handleSavePhotoMetadata = async (item: GalleryQueueItem) => {
    if (!item.urlsResult) {
      alert("Cannot save photo metadata before uploads complete.");
      return;
    }

    updateItem(item.id, (prev) => ({
      ...prev,
      status: "SAVING_METADATA",
      statusText: "Saving photo metadata into Turso DB...",
    }));

    const res = await saveGalleryPhoto({
      title: item.form.title,
      slug: item.form.slug,
      description: item.form.description || null,
      originalUrl: item.urlsResult.urls.original.publicUrl,
      largeUrl: item.urlsResult.urls.large.publicUrl,
      mediumUrl: item.urlsResult.urls.medium.publicUrl,
      thumbnailUrl: item.urlsResult.urls.thumbnail.publicUrl,
      width: item.derivatives?.width || item.exif.width || null,
      height: item.derivatives?.height || item.exif.height || null,
      fileSize: item.file.size,
      mimeType: item.file.type,
      camera: item.form.camera || null,
      lens: item.form.lens || null,
      focalLength: item.form.focalLength || null,
      aperture: item.form.aperture || null,
      shutterSpeed: item.form.shutterSpeed || null,
      iso: item.form.iso ? Number(item.form.iso) : null,
      takenAt: item.form.takenAt || null,
      latitude: item.form.latitude ? Number(item.form.latitude) : null,
      longitude: item.form.longitude ? Number(item.form.longitude) : null,
      locationName: item.form.locationName || null,
      locationId: item.form.locationId || null,
      tripId: item.form.tripId || null,
      visibility: item.form.visibility,
      featured: item.form.featured,
      processingStatus: "ready",
      tags: item.form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      album: item.form.album || null,
    });

    if (res.success) {
      updateItem(item.id, (prev) => ({
        ...prev,
        status: "SAVED",
        statusText: "Saved and published!",
      }));
      if (onUploadSuccess) onUploadSuccess();
    } else {
      updateItem(item.id, (prev) => ({
        ...prev,
        status: "ERROR",
        statusText: "Failed to save metadata.",
        error: res.error || "Save failed.",
      }));
    }
  };

  const activeItem = queue.find((i) => i.id === activeItemId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} onPaste={handlePaste}>
      {/* Drop Zone Header */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: isDragging ? "2px dashed var(--accent)" : "2px dashed var(--border-color)",
          backgroundColor: isDragging ? "var(--bg-hover)" : "var(--bg-card)",
          padding: "36px 20px",
          textAlign: "center",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFilesToQueue(e.target.files);
          }}
        />
        <UploadCloud size={40} style={{ color: "var(--accent)", marginBottom: "12px" }} />
        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
          Drag & Drop High-Res Photographs Here
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          or click to browse from disk (Supports JPG, PNG, WEBP, TIFF). Paste from clipboard works too.
        </p>
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            display: "inline-block",
            marginTop: "12px",
            fontFamily: "var(--font-mono)",
            background: "var(--bg-sidebar)",
            padding: "2px 8px",
            borderRadius: "2px",
          }}
        >
          ⚡ Client-Side Web Worker Resizing • Direct Cloudflare R2 Upload Pipeline
        </span>
      </div>

      {/* Main Upload Desktop Queue & Metadata Inspector */}
      {queue.length > 0 && (
        <div className="gallery-desktop-container">
          {/* Left Column: Queue List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              borderRight: "1px solid var(--border-color)",
              paddingRight: "16px",
              maxHeight: "650px",
              overflowY: "auto",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              Upload Queue ({queue.length})
            </div>

            {queue.map((item) => {
              const isSelected = item.id === activeItemId;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveItemId(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    borderRadius: "4px",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                    backgroundColor: isSelected ? "var(--bg-hover)" : "var(--bg-card)",
                    cursor: "pointer",
                    minWidth: 0,
                  }}
                >
                  <img
                    src={item.previewUrl || "/placeholder.png"}
                    alt={item.title}
                    style={{
                      width: "44px",
                      height: "44px",
                      objectFit: "cover",
                      borderRadius: "2px",
                      background: "#000",
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "13px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.form.title || item.file.name}
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {item.statusText}
                    </div>

                    {/* Progress bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "var(--border-color)",
                        borderRadius: "2px",
                        marginTop: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${item.progress}%`,
                          backgroundColor:
                            item.status === "ERROR"
                              ? "#d32f2f"
                              : item.status === "SAVED"
                              ? "#2e7d32"
                              : "var(--accent)",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveItem(item.id);
                    }}
                    className="btn btn-sm btn-danger"
                    style={{ padding: "4px" }}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected File Metadata & Progress Inspector */}
          {activeItem ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--border-color)",
                  flexWrap: "wrap",
                  gap: "12px",
                  minWidth: 0,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeItem.form.title || activeItem.file.name}
                  </h3>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {(activeItem.file.size / (1024 * 1024)).toFixed(2)} MB • {activeItem.file.type}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {activeItem.status === "ERROR" && (
                    <button
                      type="button"
                      onClick={() => handleRetryItem(activeItem.id)}
                      className="btn btn-sm"
                    >
                      <RefreshCw size={14} />
                      <span>Retry</span>
                    </button>
                  )}

                  {activeItem.status === "SAVED" ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#2e7d32",
                        fontWeight: 600,
                        fontSize: "13px",
                      }}
                    >
                      <CheckCircle2 size={16} /> Saved & Published
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSavePhotoMetadata(activeItem)}
                      disabled={
                        (activeItem.status !== "UPLOADS_COMPLETE" && activeItem.status !== "THUMBNAIL_READY") ||
                        (activeItem.status as string) === "SAVING_METADATA"
                      }
                      className="btn btn-primary"
                    >
                      {(activeItem.status as string) === "SAVING_METADATA" ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      <span>
                        {(activeItem.status as string) === "SAVING_METADATA"
                          ? "Saving Photo Metadata..."
                          : "Confirm & Save Photo Metadata"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress & Live Derivative Status Indicator */}
              <div
                style={{
                  background: "var(--bg-sidebar)",
                  padding: "12px",
                  borderRadius: "4px",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Status: <strong>{activeItem.statusText}</strong></span>
                  <span>{activeItem.progress}%</span>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    background: "var(--border-color)",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${activeItem.progress}%`,
                      backgroundColor: activeItem.status === "ERROR" ? "#d32f2f" : "var(--accent)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>

              {/* Form & EXIF Metadata Section */}
              <div className="gallery-form-grid">
                {/* General Metadata Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                    Photo Information
                  </h4>

                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input
                      type="text"
                      className="text-input"
                      value={activeItem.form.title}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, title: e.target.value, slug: generatePhotoSlug(e.target.value) },
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Slug</label>
                    <input
                      type="text"
                      className="text-input"
                      value={activeItem.form.slug}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, slug: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="text-input"
                      rows={3}
                      value={activeItem.form.description}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, description: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", minWidth: 0 }}>
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Album / Collection</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="e.g. Travel 2026"
                        value={activeItem.form.album}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, album: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Tags (comma separated)</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="landscape, sunset, puri"
                        value={activeItem.form.tags}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, tags: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                      <input
                        type="checkbox"
                        checked={activeItem.form.featured}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, featured: e.target.checked },
                          }))
                        }
                      />
                      <span>Featured Photo</span>
                    </label>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="form-label">Visibility:</span>
                      <select
                        className="select-input"
                        value={activeItem.form.visibility}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, visibility: e.target.value as any },
                          }))
                        }
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                        <option value="unlisted">Unlisted</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Camera EXIF Technical Details Form */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                    EXIF Technical Metadata
                  </h4>

                  <div className="form-group">
                    <label className="form-label">Camera</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="e.g. Sony ILCE-7RM4"
                      value={activeItem.form.camera}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, camera: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Lens</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="e.g. FE 24-70mm F2.8 GM"
                      value={activeItem.form.lens}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, lens: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <div className="gallery-technical-grid">
                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Focal</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="35mm"
                        value={activeItem.form.focalLength}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, focalLength: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Aperture</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="f/2.8"
                        value={activeItem.form.aperture}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, aperture: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Shutter</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="1/500s"
                        value={activeItem.form.shutterSpeed}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, shutterSpeed: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">ISO</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="100"
                        value={activeItem.form.iso}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, iso: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Capture Date</label>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="ISO Timestamp"
                      value={activeItem.form.takenAt}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, takenAt: e.target.value },
                        }))
                      }
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
                      value={activeItem.form.locationId}
                      onFocus={loadEntities}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const foundLoc = locationsList.find((l) => l.id === selectedId);
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: {
                            ...prev.form,
                            locationId: selectedId,
                            locationName: foundLoc ? foundLoc.name : "",
                            latitude: foundLoc && foundLoc.latitude ? String(foundLoc.latitude) : prev.form.latitude,
                            longitude: foundLoc && foundLoc.longitude ? String(foundLoc.longitude) : prev.form.longitude,
                          },
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
                      value={activeItem.form.tripId}
                      onFocus={loadEntities}
                      onChange={(e) =>
                        updateItem(activeItem.id, (prev) => ({
                          ...prev,
                          form: { ...prev.form, tripId: e.target.value },
                        }))
                      }
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
                        value={activeItem.form.latitude}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, latitude: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="form-group" style={{ minWidth: 0 }}>
                      <label className="form-label">Longitude</label>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="85.8312"
                        value={activeItem.form.longitude}
                        onChange={(e) =>
                          updateItem(activeItem.id, (prev) => ({
                            ...prev,
                            form: { ...prev.form, longitude: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              Select a photo from the queue on the left to inspect metadata.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
