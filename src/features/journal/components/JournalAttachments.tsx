"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { JournalAssetRecord } from "@/db/schema";
import { useJournalAuth } from "../context/JournalAuthContext";
import {
  processAndUploadEncryptedJournalAsset,
  downloadAndDecryptJournalAssetBlob,
} from "../lib/crypto-assets";
import {
  getJournalAssetsForEntryAction,
  deleteJournalAssetAction,
} from "../actions";
import { JournalLightboxModal, LightboxItem } from "./JournalLightboxModal";
import { notify } from "@/lib/notifications";
import {
  Paperclip,
  UploadCloud,
  LayoutGrid,
  List,
  Trash2,
  Download,
  Lock,
  Loader2,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Maximize2,
} from "lucide-react";

interface UploadQueueItem {
  id: string;
  file: File;
  progressPercent: number;
  statusText: string;
  status: "queued" | "uploading" | "complete" | "error";
  errorMsg?: string;
  createdRecord?: JournalAssetRecord;
}

interface JournalAttachmentsProps {
  entryId?: string;
  onAssetsChange?: () => void;
}

export function JournalAttachments({ entryId, onAssetsChange }: JournalAttachmentsProps) {
  const { cryptoKey } = useJournalAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Upload Queue state
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const isProcessingQueue = useRef(false);

  // Decrypted Thumbnail Cache URLs for gallery view
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch attached assets when entryId changes
  const loadEntryAssets = useCallback(async () => {
    if (!entryId) return;
    setLoadingAssets(true);
    try {
      const records = await getJournalAssetsForEntryAction(entryId);
      // Filter out inline images if any, focusing on attachments
      const attachOnly = records.filter((r) => r && r.assetRole === "attachment");
      setAssets(attachOnly);
    } catch (err) {
      console.error("Failed to load journal attachments:", err);
    } finally {
      setLoadingAssets(false);
    }
  }, [entryId]);

  useEffect(() => {
    loadEntryAssets();
  }, [loadEntryAssets]);

  // 2. Decrypt Thumbnails for Attached Assets
  useEffect(() => {
    if (!cryptoKey || assets.length === 0) return;

    let isMounted = true;
    const createdUrls: string[] = [];

    const decryptThumbnails = async () => {
      for (const item of assets) {
        if (thumbUrls[item.id]) continue; // Already decrypted
        try {
          const url = await downloadAndDecryptJournalAssetBlob({
            cloudinaryPublicId: item.cloudinaryThumbnailPublicId,
            iv: item.thumbnailIv,
            dekKey: cryptoKey,
            mimeType: item.mimeType || "image/webp",
          });
          if (isMounted) {
            createdUrls.push(url);
            setThumbUrls((prev) => ({ ...prev, [item.id]: url }));
          } else {
            URL.revokeObjectURL(url);
          }
        } catch (err) {
          console.error(`Failed to decrypt thumbnail for ${item.id}:`, err);
        }
      }
    };

    decryptThumbnails();

    return () => {
      isMounted = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [cryptoKey, assets]);

  // 3. Process Upload Queue Sequentially
  useEffect(() => {
    if (!cryptoKey || queue.length === 0 || isProcessingQueue.current) return;

    const nextItem = queue.find((i) => i.status === "queued");
    if (!nextItem) return;

    isProcessingQueue.current = true;

    const processItem = async () => {
      setQueue((prev) =>
        prev.map((i) => (i.id === nextItem.id ? { ...i, status: "uploading" } : i))
      );

      try {
        const record = await processAndUploadEncryptedJournalAsset({
          file: nextItem.file,
          dekKey: cryptoKey,
          entryId,
          assetRole: "attachment",
          onProgress: (percent, text) => {
            setQueue((prev) =>
              prev.map((i) =>
                i.id === nextItem.id ? { ...i, progressPercent: percent, statusText: text } : i
              )
            );
          },
        });

        setQueue((prev) =>
          prev.map((i) =>
            i.id === nextItem.id
              ? { ...i, status: "complete", progressPercent: 100, createdRecord: record }
              : i
          )
        );

        setAssets((prev) => [
          ...prev,
          { ...record, linkId: record.id, assetRole: "attachment", position: prev.length },
        ]);
        onAssetsChange?.();
      } catch (err: any) {
        console.error("Attachment upload error:", err);
        setQueue((prev) =>
          prev.map((i) =>
            i.id === nextItem.id
              ? { ...i, status: "error", errorMsg: err?.message || "Upload failed" }
              : i
          )
        );
      } finally {
        isProcessingQueue.current = false;
      }
    };

    processItem();
  }, [queue, cryptoKey, entryId, onAssetsChange]);

  const handleSelectFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newQueueItems: UploadQueueItem[] = Array.from(files).map((f) => ({
      id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      progressPercent: 0,
      statusText: "Waiting in queue...",
      status: "queued",
    }));

    setQueue((prev) => [...prev, ...newQueueItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAsset = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this encrypted attachment?")) return;

    try {
      await deleteJournalAssetAction(assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      notify.show({ type: "success", message: "Attachment deleted" });
      onAssetsChange?.();
    } catch (err) {
      notify.show({ type: "error", message: "Failed to delete attachment" });
    }
  };

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const lightboxItems: LightboxItem[] = assets.map((a) => ({
    assetId: a.id,
    assetRecord: a,
    cloudinaryOriginalPublicId: a.cloudinaryOriginalPublicId,
    originalIv: a.originalIv,
    mimeType: a.mimeType,
    width: a.width,
    height: a.height,
  }));

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        marginTop: "32px",
        padding: "20px 24px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
      }}
    >
      {/* Header & Upload Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Paperclip size={18} style={{ color: "var(--accent)" }} />
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
            Encrypted Entry Attachments ({assets.length})
          </h3>
          <div
            style={{
              fontSize: "11px",
              backgroundColor: "rgba(249, 115, 22, 0.12)",
              color: "var(--accent)",
              padding: "2px 8px",
              borderRadius: "4px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Lock size={11} />
            <span>E2EE Blobs</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* View Mode Toggle */}
          <div style={{ display: "flex", backgroundColor: "var(--bg-hover)", borderRadius: "6px", padding: "2px" }}>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              style={{
                background: viewMode === "grid" ? "var(--bg-card)" : "none",
                border: "none",
                color: viewMode === "grid" ? "var(--accent)" : "var(--text-muted)",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                background: viewMode === "list" ? "var(--bg-card)" : "none",
                border: "none",
                color: viewMode === "list" ? "var(--accent)" : "var(--text-muted)",
                padding: "4px 8px",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <List size={15} />
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleSelectFiles(e.target.files)}
            style={{ display: "none" }}
          />

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            style={{ fontSize: "13px", padding: "6px 14px" }}
          >
            <UploadCloud size={15} />
            <span>Add Attachment</span>
          </button>
        </div>
      </div>

      {/* Active Upload Queue */}
      {queue.length > 0 && (
        <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {queue.map((q) => (
            <div
              key={q.id}
              style={{
                padding: "10px 14px",
                backgroundColor: "var(--bg-hover)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontWeight: 600 }}>{q.file.name}</span>
                <span style={{ color: q.status === "error" ? "#ef4444" : "var(--text-muted)" }}>
                  {q.statusText} ({q.progressPercent}%)
                </span>
              </div>
              <div style={{ height: "4px", backgroundColor: "var(--border-color)", borderRadius: "2px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${q.progressPercent}%`,
                    backgroundColor: q.status === "error" ? "#ef4444" : "var(--accent)",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachments List / Grid View */}
      {loadingAssets ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          <Loader2 size={20} className="spin" style={{ color: "var(--accent)", margin: "0 auto 8px" }} />
          <div>Loading encrypted attachments...</div>
        </div>
      ) : assets.length === 0 && queue.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed var(--border-color)",
            borderRadius: "8px",
            padding: "32px 16px",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: "var(--bg-hover)",
            transition: "border-color 0.2s",
          }}
        >
          <FileImage size={32} style={{ color: "var(--text-muted)", marginBottom: "8px" }} />
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            No attachments added to this entry yet
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Click here or drag photos to upload end-to-end encrypted attachments.
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "12px" }}>
          {assets.map((item, index) => {
            const thumb = thumbUrls[item.id];
            return (
              <div
                key={item.id}
                onClick={() => handleOpenLightbox(index)}
                style={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-hover)",
                  cursor: "pointer",
                }}
              >
                {thumb ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumb}
                    alt={item.id}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                    <Loader2 size={16} className="spin" />
                  </div>
                )}

                {/* Hover overlay with action buttons */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    opacity: 0,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                >
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAsset(item.id, e)}
                    style={{
                      background: "rgba(239, 68, 68, 0.8)",
                      border: "none",
                      color: "#fff",
                      padding: "6px",
                      borderRadius: "50%",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {assets.map((item, index) => {
            const thumb = thumbUrls[item.id];
            return (
              <div
                key={item.id}
                onClick={() => handleOpenLightbox(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  backgroundColor: "var(--bg-hover)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "6px", overflow: "hidden", backgroundColor: "var(--bg-card)", flexShrink: 0 }}>
                    {thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={thumb} alt={item.id} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Loader2 size={14} className="spin" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      Photo Attachment ({item.width} × {item.height})
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {formatFileSize(item.compressedSize)} • AES-256-GCM Encrypted
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAsset(item.id, e)}
                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "4px" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <JournalLightboxModal
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          items={lightboxItems}
          initialIndex={lightboxIndex}
        />
      )}
    </div>
  );
}
