"use client";

import React, { useState, useEffect } from "react";
import { compressImageLocally } from "@/lib/image-compressor";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { Upload, Image as ImageIcon, Check, Settings, Copy, RefreshCw, Layers } from "lucide-react";

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

  // Cloudinary credentials state
  const [cloudName, setCloudName] = useState<string>("");
  const [uploadPreset, setUploadPreset] = useState<string>("");
  const [showConfig, setShowConfig] = useState<boolean>(false);

  useEffect(() => {
    const envCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
    const envPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";
    const savedCloud = localStorage.getItem("cloudinary-cloud-name") || envCloud;
    const savedPreset = localStorage.getItem("cloudinary-upload-preset") || envPreset;

    setCloudName(savedCloud);
    setUploadPreset(savedPreset);

    if (!savedCloud || !savedPreset) {
      setShowConfig(true);
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem("cloudinary-cloud-name", cloudName.trim());
    localStorage.setItem("cloudinary-upload-preset", uploadPreset.trim());
    setShowConfig(false);
  };

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
    setUploadStatus("Processing image...");

    try {
      let fileToUpload = selectedFile;

      if (compressLocally) {
        setUploadStatus("Compressing locally in browser...");
        fileToUpload = await compressImageLocally(selectedFile, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8,
        });
      }

      setUploadStatus("Uploading directly to Cloudinary...");
      const result = await uploadDirectToCloudinary(
        fileToUpload,
        cloudName || undefined,
        uploadPreset || undefined
      );

      setUploadedUrl(result.secure_url);
      setUploadStatus(`Uploaded successfully! (${Math.round(result.bytes / 1024)} KB)`);
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
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setShowConfig(!showConfig)}
          title="Cloudinary Credentials Settings"
        >
          <Settings size={14} />
          <span>Config</span>
        </button>
      </div>

      {/* Credentials Configuration Form */}
      {showConfig && (
        <div
          style={{
            background: "var(--bg-sidebar)",
            border: "1px solid var(--border-color)",
            padding: "10px",
            fontSize: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontWeight: "bold" }}>Cloudinary Credentials (Direct Unsigned Upload)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "11px", display: "block" }}>Cloud Name</label>
              <input
                type="text"
                className="text-input"
                style={{ width: "100%", fontSize: "12px" }}
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="e.g. my-cloud-name"
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", display: "block" }}>Upload Preset</label>
              <input
                type="text"
                className="text-input"
                style={{ width: "100%", fontSize: "12px" }}
                value={uploadPreset}
                onChange={(e) => setUploadPreset(e.target.value)}
                placeholder="e.g. my_unsigned_preset"
              />
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={saveConfig} style={{ alignSelf: "flex-end" }}>
            Save Credentials
          </button>
        </div>
      )}

      {/* Compression Toggle & File Selection */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ fontSize: "12px" }}
          id="cloudinary-file-input"
        />

        <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={compressLocally}
            onChange={(e) => setCompressLocally(e.target.checked)}
          />
          <span>Compress locally in browser (HTML5 Canvas)</span>
        </label>
      </div>

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
          }}
        >
          {localPreviewUrl && (
            <div style={{ position: "relative", width: "70px", height: "70px", flexShrink: 0, border: "1px solid var(--border-color)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedUrl || localPreviewUrl}
                alt="Upload preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}

          <div style={{ flex: 1, fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ fontWeight: "bold" }}>{selectedFile.name}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
              Original Size: {formatFileSize(selectedFile.size)} | Compression: {compressLocally ? "Enabled (0.8 quality)" : "Disabled"}
            </div>

            {uploadStatus && (
              <div style={{ fontSize: "11px", color: uploadedUrl ? "#2e7d32" : "var(--accent)", fontWeight: "500" }}>
                {uploadStatus}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleUpload}
              disabled={isUploading}
            >
              <Upload size={14} />
              <span>{isUploading ? "Uploading..." : "Upload to Cloudinary"}</span>
            </button>

            {uploadedUrl && onInsertMarkdown && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onInsertMarkdown(`![${selectedFile.name}](${uploadedUrl})`)}
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
