"use client";

import React, { useState, useEffect } from "react";
import { compressImageLocally } from "@/lib/image-compressor";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { Upload, Image as ImageIcon, Copy } from "lucide-react";

interface CloudinaryImageUploaderProps {
  onImageUploaded: (url: string) => void;
  onInsertMarkdown?: (markdownSnippet: string) => void;
}

export function CloudinaryImageUploader({
  onImageUploaded,
  onInsertMarkdown,
}: CloudinaryImageUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [compressLocally, setCompressLocally] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  // Local compression configuration parameters
  const [quality, setQuality] = useState<number>(0.8);
  const [maxWidth, setMaxWidth] = useState<number>(1920);
  const [maxHeight, setMaxHeight] = useState<number>(1080);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressedPreviewUrl, setCompressedPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const isConfigured = !!cloudName && !!uploadPreset;

  // Reactively perform local compression in the background
  useEffect(() => {
    if (!selectedFile) {
      setCompressedFile(null);
      setCompressedPreviewUrl(null);
      return;
    }

    if (!compressLocally) {
      setCompressedFile(null);
      setCompressedPreviewUrl(null);
      return;
    }

    let active = true;
    const runCompression = async () => {
      setIsCompressing(true);
      try {
        const result = await compressImageLocally(selectedFile, {
          maxWidth,
          maxHeight,
          quality,
        });
        if (active) {
          setCompressedFile(result);
          const objectUrl = URL.createObjectURL(result);
          setCompressedPreviewUrl(objectUrl);
        }
      } catch (err) {
        console.error("Compression error:", err);
      } finally {
        if (active) {
          setIsCompressing(false);
        }
      }
    };

    // Tiny debounce (250ms) to prevent UI stutter on slider drag
    const timer = setTimeout(runCompression, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedFile, compressLocally, quality, maxWidth, maxHeight]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadedUrl(null);
    setUploadStatus(null);

    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus("Uploading directly to Cloudinary...");

    try {
      // Use the pre-compressed file if compression is enabled
      const fileToUpload = (compressLocally && compressedFile) ? compressedFile : selectedFile;
      const result = await uploadDirectToCloudinary(fileToUpload);

      setUploadedUrl(result.secure_url);
      setUploadStatus(`Uploaded successfully! (${formatFileSize(result.bytes)})`);
      onImageUploaded(result.secure_url);
    } catch (err: any) {
      console.error(err);
      setUploadStatus(`Upload failed: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!isConfigured) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px dashed #d32f2f",
          padding: "14px",
          color: "#c62828",
          fontSize: "12px",
          borderRadius: "2px",
        }}
      >
        <span style={{ fontWeight: "bold" }}>Cloudinary is not configured.</span> Please define{" "}
        <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{" "}
        <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in your <code>.env</code> file to enable direct uploads.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: "bold", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
          <ImageIcon size={16} />
          <span>Cloudinary Media Direct Upload</span>
        </div>
      </div>

      {/* Compression Toggle & File Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ fontSize: "12px" }}
          id="cloudinary-file-input"
        />

        <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "600" }}>
          <input
            type="checkbox"
            checked={compressLocally}
            onChange={(e) => setCompressLocally(e.target.checked)}
          />
          <span>Compress locally in browser (HTML5 Canvas) before upload</span>
        </label>
      </div>

      {/* Local Compression Option Settings Panel */}
      {compressLocally && selectedFile && (
        <div
          style={{
            background: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            fontSize: "12px",
          }}
        >
          <div style={{ fontWeight: "bold" }}>Local Compression Settings</div>
          
          <div className="editor-settings-grid" style={{ padding: 0, border: "none", background: "none" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: "11px" }}>Quality ({Math.round(quality * 100)}%)</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                style={{ width: "100%", cursor: "pointer" }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: "11px" }}>Max Width (px)</label>
              <input
                type="number"
                className="text-input"
                style={{ width: "100%", padding: "4px 8px" }}
                value={maxWidth}
                onChange={(e) => setMaxWidth(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: "11px" }}>Max Height (px)</label>
              <input
                type="number"
                className="text-input"
                style={{ width: "100%", padding: "4px 8px" }}
                value={maxHeight}
                onChange={(e) => setMaxHeight(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Preview & Actions */}
      {selectedFile && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            background: "var(--bg-code)",
            padding: "8px",
            border: "1px solid var(--border-color)",
            flexWrap: "wrap",
          }}
        >
          {(compressedPreviewUrl || localPreviewUrl) && (
            <div style={{ position: "relative", width: "70px", height: "70px", flexShrink: 0, border: "1px solid var(--border-color)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compressedPreviewUrl || localPreviewUrl || ""}
                alt="Upload preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}

          <div style={{ flex: 1, minWidth: "200px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ fontWeight: "bold" }}>{selectedFile.name}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
              Original Size: <strong>{formatFileSize(selectedFile.size)}</strong>
              {compressLocally && compressedFile && (
                <>
                  {" → "}
                  Compressed Size: <strong>{formatFileSize(compressedFile.size)}</strong>
                  {compressedFile.size < selectedFile.size ? (
                    <span style={{ color: "#2e7d32", fontWeight: "bold", marginLeft: "6px" }}>
                      ({Math.round((1 - compressedFile.size / selectedFile.size) * 100)}% savings)
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>
                      (No savings, will upload original)
                    </span>
                  )}
                </>
              )}
            </div>

            {isCompressing && (
              <div style={{ fontSize: "11px", color: "var(--accent)" }}>
                Compressing image locally...
              </div>
            )}

            {uploadStatus && (
              <div style={{ fontSize: "11px", color: uploadedUrl ? "#2e7d32" : "var(--accent)", fontWeight: "500" }}>
                {uploadStatus}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", maxWidth: "150px" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleUpload}
              disabled={isUploading || isCompressing}
              style={{ justifyContent: "center" }}
            >
              <Upload size={14} />
              <span>{isUploading ? "Uploading..." : "Upload to Cloudinary"}</span>
            </button>

            {uploadedUrl && onInsertMarkdown && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onInsertMarkdown(`![${selectedFile.name}](${uploadedUrl})`)}
                style={{ justifyContent: "center" }}
              >
                <Copy size={12} />
                <span>Insert Markdown</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
