"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getGalleryPhotos } from "@/features/gallery/actions";
import { getCloudinaryResources, CloudinaryResource } from "@/features/media/cloudinaryActions";
import { connectPersonPhotosBatchAction, BatchPhotoConnectItem } from "@/features/people/actions";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { notify } from "@/lib/notifications";
import { GalleryPhoto } from "@/db/schema";
import {
  X,
  Image as ImageIcon,
  Cloud,
  Upload,
  Check,
  Search,
  Loader2,
  HardDrive,
  Plus,
} from "lucide-react";

interface PersonPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  onSuccess?: () => void;
}

interface UploadedItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "success" | "error";
  cloudinaryUrl?: string;
  publicId?: string;
  error?: string;
}

export function PersonPhotoPickerModal({
  isOpen,
  onClose,
  personId,
  personName,
  onSuccess,
}: PersonPhotoPickerModalProps) {
  const [activeTab, setActiveTab] = useState<"gallery" | "cloudinary" | "upload">("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [relationshipVerb, setRelationshipVerb] = useState("appears_in");

  // Multi-selection state mapped by unique key:
  // "gallery_${photo.id}" or "cloudinary_${resource.public_id}" or "upload_${uploadedItem.id}"
  const [selectedItems, setSelectedItems] = useState<Map<string, BatchPhotoConnectItem>>(new Map());

  // Data states
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const [cloudinaryPhotos, setCloudinaryPhotos] = useState<CloudinaryResource[]>([]);
  const [loadingCloudinary, setLoadingCloudinary] = useState(false);

  // Upload state
  const [uploadedItems, setUploadedItems] = useState<UploadedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset or load initial data when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedItems(new Map());
      setSearchQuery("");
      setRelationshipVerb("appears_in");
      setUploadedItems([]);

      // Fetch gallery photos
      setLoadingGallery(true);
      getGalleryPhotos()
        .then((photos) => setGalleryPhotos(photos))
        .catch((err) => console.error("Error loading gallery photos:", err))
        .finally(() => setLoadingGallery(false));
    }
  }, [isOpen]);

  // Load Cloudinary photos lazily when Cloudinary tab is activated
  useEffect(() => {
    if (isOpen && activeTab === "cloudinary" && cloudinaryPhotos.length === 0 && !loadingCloudinary) {
      setLoadingCloudinary(true);
      getCloudinaryResources()
        .then((res) => {
          if (res.success && res.resources) {
            setCloudinaryPhotos(res.resources);
          }
        })
        .catch((err) => console.error("Error loading Cloudinary resources:", err))
        .finally(() => setLoadingCloudinary(false));
    }
  }, [isOpen, activeTab, cloudinaryPhotos.length, loadingCloudinary]);

  // Toggle selection for an item
  const toggleItem = (key: string, item: BatchPhotoConnectItem) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, item);
      }
      return next;
    });
  };

  // Handle uploading files in the Upload tab
  const handleFilesChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: UploadedItem[] = Array.from(files).map((file) => ({
      id: `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));

    setUploadedItems((prev) => [...prev, ...newItems]);

    // Sequentially upload items to Cloudinary
    for (const item of newItems) {
      setUploadedItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "uploading" } : it))
      );

      try {
        const uploadResult = await uploadDirectToCloudinary(item.file);
        setUploadedItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "success",
                  cloudinaryUrl: uploadResult.secure_url,
                  publicId: uploadResult.public_id,
                }
              : it
          )
        );

        // Auto-select the successfully uploaded photo
        const batchItem: BatchPhotoConnectItem = {
          type: "cloudinary",
          url: uploadResult.secure_url,
          title: item.file.name,
          publicId: uploadResult.public_id,
          width: uploadResult.width,
          height: uploadResult.height,
        };
        setSelectedItems((prev) => new Map(prev).set(`upload_${item.id}`, batchItem));
      } catch (err: any) {
        console.error("Upload failed for file:", item.file.name, err);
        setUploadedItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "error", error: err.message || "Upload failed" }
              : it
          )
        );
      }
    }
  };

  const handleConnect = async () => {
    if (selectedItems.size === 0) return;

    const photosToConnect = Array.from(selectedItems.values());
    const verb = relationshipVerb.trim() || "appears_in";

    onClose();

    notify.bg({
      title: "Connect Photos",
      loadingMessage: `Connecting ${photosToConnect.length} photo(s) to ${personName}...`,
      successMessage: `Connected ${photosToConnect.length} photo(s) to ${personName}!`,
      errorMessage: (err) => `Failed to connect photos: ${err?.message || String(err)}`,
      task: async () => {
        return await connectPersonPhotosBatchAction(personId, photosToConnect, verb);
      },
      onSuccess: (res) => {
        if (res.success) {
          onSuccess?.();
        } else {
          notify.show({
            type: "error",
            title: "Connection Failed",
            message: res.error || "Failed to connect photos",
          });
        }
      },
    });
  };

  if (!isOpen) return null;

  // Filter photos based on search
  const filteredGallery = galleryPhotos.filter((p) =>
    (p.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCloudinary = cloudinaryPhotos.filter((c) =>
    (c.public_id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSelected = selectedItems.size;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(5px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(0, 122, 255, 0.12)",
                color: "#007aff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ImageIcon size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                Add Photos of {personName}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Choose existing gallery photos, pick from Cloudinary, or upload new files
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 Tab Buttons */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-hover)",
            padding: "0 16px",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("gallery")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "gallery" ? "2px solid #007aff" : "2px solid transparent",
              color: activeTab === "gallery" ? "#007aff" : "var(--text-secondary)",
              fontWeight: activeTab === "gallery" ? 700 : 500,
              padding: "12px 16px",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <HardDrive size={15} />
            <span>Gallery (Cloudflare R2)</span>
            {galleryPhotos.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: activeTab === "gallery" ? "rgba(0, 122, 255, 0.15)" : "var(--bg-card)",
                }}
              >
                {galleryPhotos.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cloudinary")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "cloudinary" ? "2px solid #007aff" : "2px solid transparent",
              color: activeTab === "cloudinary" ? "#007aff" : "var(--text-secondary)",
              fontWeight: activeTab === "cloudinary" ? 700 : 500,
              padding: "12px 16px",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Cloud size={15} />
            <span>Choose from Cloudinary</span>
            {cloudinaryPhotos.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: activeTab === "cloudinary" ? "rgba(0, 122, 255, 0.15)" : "var(--bg-card)",
                }}
              >
                {cloudinaryPhotos.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            style={{
              background: "none",
              border: "none",
              borderBottom: activeTab === "upload" ? "2px solid #007aff" : "2px solid transparent",
              color: activeTab === "upload" ? "#007aff" : "var(--text-secondary)",
              fontWeight: activeTab === "upload" ? 700 : 500,
              padding: "12px 16px",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Upload size={15} />
            <span>Upload (to Cloudinary)</span>
            {uploadedItems.length > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  backgroundColor: activeTab === "upload" ? "rgba(0, 122, 255, 0.15)" : "var(--bg-card)",
                }}
              >
                {uploadedItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* TAB 1: GALLERY (CLOUDFLARE R2) */}
          {activeTab === "gallery" && (
            <div>
              <div style={{ marginBottom: "12px", position: "relative" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search gallery photos by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "34px", width: "100%", fontSize: "13px" }}
                />
              </div>

              {loadingGallery ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <div>Loading Cloudflare R2 gallery photos...</div>
                </div>
              ) : filteredGallery.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>
                  {searchQuery ? "No gallery photos match your search." : "No gallery photos found."}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {filteredGallery.map((photo) => {
                    const key = `gallery_${photo.id}`;
                    const isSelected = selectedItems.has(key);
                    const batchItem: BatchPhotoConnectItem = {
                      type: "gallery",
                      id: photo.id,
                      title: photo.title,
                      url: photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl,
                    };

                    return (
                      <div
                        key={photo.id}
                        onClick={() => toggleItem(key, batchItem)}
                        style={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: "8px",
                          overflow: "hidden",
                          cursor: "pointer",
                          border: isSelected ? "3px solid #007aff" : "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-hover)",
                          boxShadow: isSelected ? "0 0 0 1px #007aff" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <img
                          src={photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl}
                          alt={photo.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                        {/* Checkmark indicator */}
                        <div
                          style={{
                            position: "absolute",
                            top: "6px",
                            right: "6px",
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            backgroundColor: isSelected ? "#007aff" : "rgba(0, 0, 0, 0.4)",
                            border: "1.5px solid #fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                          }}
                        >
                          {isSelected && <Check size={13} strokeWidth={3} />}
                        </div>
                        {/* Title pill */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: "4px 6px",
                            backgroundColor: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {photo.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHOOSE FROM CLOUDINARY */}
          {activeTab === "cloudinary" && (
            <div>
              <div style={{ marginBottom: "12px", position: "relative" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search Cloudinary images by ID / filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "34px", width: "100%", fontSize: "13px" }}
                />
              </div>

              {loadingCloudinary ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                  <div>Loading Cloudinary assets...</div>
                </div>
              ) : filteredCloudinary.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "13px" }}>
                  {searchQuery ? "No Cloudinary photos match your search." : "No Cloudinary photos found."}
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                    gap: "10px",
                  }}
                >
                  {filteredCloudinary.map((c) => {
                    const key = `cloudinary_${c.public_id}`;
                    const isSelected = selectedItems.has(key);
                    const batchItem: BatchPhotoConnectItem = {
                      type: "cloudinary",
                      url: c.secure_url,
                      title: c.public_id.split("/").pop() || c.public_id,
                      publicId: c.public_id,
                      width: c.width,
                      height: c.height,
                    };

                    return (
                      <div
                        key={c.public_id}
                        onClick={() => toggleItem(key, batchItem)}
                        style={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: "8px",
                          overflow: "hidden",
                          cursor: "pointer",
                          border: isSelected ? "3px solid #007aff" : "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-hover)",
                          boxShadow: isSelected ? "0 0 0 1px #007aff" : "none",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <img
                          src={c.secure_url}
                          alt={c.public_id}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          loading="lazy"
                        />
                        {/* Checkmark indicator */}
                        <div
                          style={{
                            position: "absolute",
                            top: "6px",
                            right: "6px",
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            backgroundColor: isSelected ? "#007aff" : "rgba(0, 0, 0, 0.4)",
                            border: "1.5px solid #fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                          }}
                        >
                          {isSelected && <Check size={13} strokeWidth={3} />}
                        </div>
                        {/* Public ID label */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: "4px 6px",
                            backgroundColor: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 500,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {c.public_id.split("/").pop() || c.public_id}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UPLOAD TO CLOUDINARY */}
          {activeTab === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Dropzone Box */}
              <label
                style={{
                  border: "2px dashed var(--border-color)",
                  borderRadius: "10px",
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  backgroundColor: "var(--bg-hover)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  transition: "border-color 0.2s ease",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#007aff";
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  handleFilesChosen(e.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleFilesChosen(e.target.files)}
                />
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0, 122, 255, 0.1)",
                    color: "#007aff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Upload size={22} />
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Click to select or drag and drop images
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Images are uploaded directly to Cloudinary and auto-selected for this person
                  </div>
                </div>
              </label>

              {/* Uploaded items preview list */}
              {uploadedItems.length > 0 && (
                <div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "10px", margin: "0 0 10px" }}>
                    Uploaded Images ({uploadedItems.length})
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    {uploadedItems.map((item) => {
                      const key = `upload_${item.id}`;
                      const isSelected = selectedItems.has(key);
                      const isSuccess = item.status === "success";

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isSuccess && item.cloudinaryUrl) {
                              toggleItem(key, {
                                type: "cloudinary",
                                url: item.cloudinaryUrl,
                                title: item.file.name,
                                publicId: item.publicId,
                              });
                            }
                          }}
                          style={{
                            position: "relative",
                            aspectRatio: "1",
                            borderRadius: "8px",
                            overflow: "hidden",
                            cursor: isSuccess ? "pointer" : "default",
                            border: isSelected ? "3px solid #007aff" : "1px solid var(--border-color)",
                            backgroundColor: "var(--bg-hover)",
                          }}
                        >
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />

                          {/* Loading overlay */}
                          {item.status === "uploading" && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: "rgba(0,0,0,0.6)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                gap: "4px",
                                fontSize: "11px",
                              }}
                            >
                              <Loader2 size={18} className="animate-spin" />
                              <span>Uploading...</span>
                            </div>
                          )}

                          {/* Error overlay */}
                          {item.status === "error" && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: "rgba(239, 68, 68, 0.75)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                padding: "4px",
                                textAlign: "center",
                                fontSize: "10px",
                              }}
                            >
                              <div>Failed</div>
                            </div>
                          )}

                          {/* Checkmark for successfully uploaded and selected */}
                          {isSuccess && (
                            <div
                              style={{
                                position: "absolute",
                                top: "6px",
                                right: "6px",
                                width: "22px",
                                height: "22px",
                                borderRadius: "50%",
                                backgroundColor: isSelected ? "#007aff" : "rgba(0, 0, 0, 0.4)",
                                border: "1.5px solid #fff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                              }}
                            >
                              {isSelected && <Check size={13} strokeWidth={3} />}
                            </div>
                          )}

                          <div
                            style={{
                              position: "absolute",
                              bottom: 0,
                              left: 0,
                              right: 0,
                              padding: "4px 6px",
                              backgroundColor: "rgba(0,0,0,0.6)",
                              color: "#fff",
                              fontSize: "10px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.file.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: totalSelected > 0 ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {totalSelected} photo{totalSelected === 1 ? "" : "s"} selected
            </span>

            {totalSelected > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Verb:</span>
                <input
                  type="text"
                  value={relationshipVerb}
                  onChange={(e) => setRelationshipVerb(e.target.value)}
                  placeholder="appears_in"
                  style={{
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-hover)",
                    color: "var(--text-primary)",
                    width: "100px",
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleConnect}
              disabled={totalSelected === 0 || isSubmitting}
              style={{
                backgroundColor: totalSelected > 0 ? "#007aff" : undefined,
                borderColor: totalSelected > 0 ? "#007aff" : undefined,
                color: "#fff",
              }}
            >
              <Plus size={14} />
              <span>Connect {totalSelected > 0 ? `(${totalSelected})` : "Photos"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
