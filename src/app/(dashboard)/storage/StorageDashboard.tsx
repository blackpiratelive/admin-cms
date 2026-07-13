"use client";

import React, { useState } from "react";
import {
  type CloudinaryUsageData,
  type CloudinaryResource,
  deleteCloudinaryResource,
} from "@/features/media/cloudinaryActions";
import {
  HardDrive,
  Activity,
  FileImage,
  Trash2,
  Copy,
  ExternalLink,
  Check,
  AlertCircle,
  Database,
} from "lucide-react";

interface StorageDashboardProps {
  initialUsage: CloudinaryUsageData | null;
  initialResources: CloudinaryResource[];
  error: string | null;
}

export function StorageDashboard({
  initialUsage,
  initialResources,
  error,
}: StorageDashboardProps) {
  const [resources, setResources] = useState<CloudinaryResource[]>(initialResources);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleCopyUrl = async (url: string, publicId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(publicId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  const handleDelete = async (publicId: string) => {
    if (!confirm("Are you sure you want to permanently delete this asset from Cloudinary?")) {
      return;
    }

    setDeletingId(publicId);
    setDeleteError(null);

    try {
      const res = await deleteCloudinaryResource(publicId);
      if (res.success) {
        setResources((prev) => prev.filter((r) => r.public_id !== publicId));
      } else {
        setDeleteError(res.error || "Failed to delete asset.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "An unexpected error occurred.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <h1 className="page-title">
          <Database size={18} />
          <span>Cloudinary Media Storage</span>
        </h1>
      </div>

      {error && (
        <div
          style={{
            background: "#ffebee",
            border: "1px dashed #d32f2f",
            padding: "14px",
            color: "#c62828",
            fontSize: "12px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} />
          <div>
            <strong>Configuration Warning:</strong> {error}
            <br />
            Make sure <code>CLOUDINARY_API_KEY</code> and <code>CLOUDINARY_API_SECRET</code> are set in your <code>.env</code> file.
          </div>
        </div>
      )}

      {deleteError && (
        <div
          style={{
            background: "#ffebee",
            border: "1px solid #d32f2f",
            padding: "10px 14px",
            color: "#c62828",
            fontSize: "12px",
            borderRadius: "2px",
          }}
        >
          {deleteError}
        </div>
      )}

      {/* Cloudinary Usage Stats Summary */}
      {initialUsage && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {/* Storage metric */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Storage Usage</span>
              <HardDrive size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>
              {formatBytes(initialUsage.storage.usage)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Limit: {formatBytes(initialUsage.storage.limit)} ({initialUsage.storage.used_percent}%)
            </div>
            <div style={{ height: "4px", background: "var(--bg-sidebar)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  width: `${Math.min(initialUsage.storage.used_percent, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Bandwidth metric */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Bandwidth Usage (Monthly)</span>
              <Activity size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>
              {formatBytes(initialUsage.bandwidth.usage)}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              Limit: {formatBytes(initialUsage.bandwidth.limit)} ({initialUsage.bandwidth.used_percent}%)
            </div>
            <div style={{ height: "4px", background: "var(--bg-sidebar)", borderRadius: "2px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  width: `${Math.min(initialUsage.bandwidth.used_percent, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Assets Count metric */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Total Images</span>
              <FileImage size={16} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>
              {initialUsage.resources}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Directly managed media assets
            </div>
          </div>

          {/* Plan Info */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "16px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>Cloudinary Plan</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", textTransform: "uppercase", color: "var(--accent)" }}>
              {initialUsage.plan}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px" }}>
              Limits reset monthly
            </div>
          </div>
        </div>
      )}

      {/* Cloudinary media files grid */}
      <div>
        <h2 style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "12px" }}>
          Uploaded Content List ({resources.length})
        </h2>

        {resources.length === 0 ? (
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px dashed var(--border-color)",
              padding: "40px",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            No media files found in Cloudinary or credentials missing.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            {resources.map((res) => (
              <div
                key={res.public_id}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "2px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Thumbnail Preview */}
                <div
                  style={{
                    height: "120px",
                    background: "var(--bg-sidebar)",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={res.secure_url}
                    alt={res.public_id}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      transition: "transform 0.2s",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      right: "4px",
                      background: "rgba(0, 0, 0, 0.6)",
                      color: "#fff",
                      fontSize: "9px",
                      padding: "1px 4px",
                      borderRadius: "2px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {res.width}x{res.height}
                  </span>
                </div>

                {/* Details */}
                <div style={{ padding: "10px", flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      wordBreak: "break-all",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      height: "32px",
                      lineHeight: "16px",
                    }}
                    title={res.public_id}
                  >
                    {res.public_id}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)" }}>
                    <span>{formatBytes(res.bytes)}</span>
                    <span style={{ textTransform: "uppercase" }}>{res.format}</span>
                  </div>

                  <div style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Uploaded: {new Date(res.created_at).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      marginTop: "8px",
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "8px",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleCopyUrl(res.secure_url, res.public_id)}
                      title="Copy URL"
                      style={{ flex: 1, justifyContent: "center", padding: "4px" }}
                    >
                      {copiedId === res.public_id ? <Check size={12} style={{ color: "#2e7d32" }} /> : <Copy size={12} />}
                    </button>
                    <a
                      href={res.secure_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      title="Open URL"
                      style={{ flex: 1, justifyContent: "center", padding: "4px" }}
                    >
                      <ExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(res.public_id)}
                      disabled={deletingId === res.public_id}
                      title="Delete"
                      style={{ flex: 1, justifyContent: "center", padding: "4px" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
