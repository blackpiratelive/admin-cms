"use client";

import { useState } from "react";
import { X, Columns2, Maximize2 } from "lucide-react";
import type { PhotoSessionWithPhotos } from "../types";
import type { HealthScalpPhotoRecord } from "@/db/schema";

interface PhotoComparisonModalProps {
  sessions: PhotoSessionWithPhotos[];
  initialPhoto?: HealthScalpPhotoRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PhotoComparisonModal({
  sessions,
  initialPhoto,
  isOpen,
  onClose,
}: PhotoComparisonModalProps) {
  // Flatten all photos with their session metadata for easy lookup
  const allPhotos = sessions.flatMap((s) =>
    s.photos.map((p) => ({
      ...p,
      sessionDate: s.sessionDate,
      weekNumber: s.weekNumber,
    }))
  );

  const defaultPhotoId = initialPhoto?.id || (allPhotos[0]?.id ?? null);
  const [leftPhotoId, setLeftPhotoId] = useState<string | null>(defaultPhotoId);
  const [rightPhotoId, setRightPhotoId] = useState<string | null>(
    allPhotos.length > 1 ? allPhotos[1]?.id : defaultPhotoId
  );
  const [isSplitMode, setIsSplitMode] = useState(allPhotos.length > 1);

  if (!isOpen || allPhotos.length === 0) return null;

  const leftPhoto = allPhotos.find((p) => p.id === leftPhotoId) || allPhotos[0];
  const rightPhoto = allPhotos.find((p) => p.id === rightPhotoId) || allPhotos[1] || leftPhoto;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1200,
        background: "rgba(0, 0, 0, 0.88)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "1050px",
          width: "95vw",
          maxHeight: "94vh",
          display: "flex",
          flexDirection: "column",
          padding: "16px 20px",
          background: "var(--bg-main, #121212)",
          borderColor: "var(--border-color)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            paddingBottom: "10px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>
              Scalp Photo Inspector
            </h2>
            {allPhotos.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                onClick={() => setIsSplitMode(!isSplitMode)}
              >
                {isSplitMode ? <Maximize2 size={13} /> : <Columns2 size={13} />}
                <span>{isSplitMode ? "Single View" : "Compare (Side-by-Side)"}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isSplitMode ? "1fr 1fr" : "1fr",
            gap: "16px",
            flex: 1,
            minHeight: "360px",
            overflow: "hidden",
          }}
        >
          {/* Left Photo */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#000",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <select
                className="form-input"
                style={{ fontSize: "12px", padding: "4px 8px", width: "auto", maxWidth: "260px", height: "auto" }}
                value={leftPhoto.id}
                onChange={(e) => setLeftPhotoId(e.target.value)}
              >
                {allPhotos.map((p) => (
                  <option key={p.id} value={p.id}>
                    Week {p.weekNumber} ({p.sessionDate}) — {p.angle}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "12px", color: "var(--accent-primary, #f97316)", fontWeight: 600 }}>
                Week {leftPhoto.weekNumber}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: "8px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={leftPhoto.cloudinaryUrl}
                alt={`Week ${leftPhoto.weekNumber} - ${leftPhoto.angle}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "68vh",
                  objectFit: "contain",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          {/* Right Photo (if split mode) */}
          {isSplitMode && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#000",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <select
                  className="form-input"
                  style={{ fontSize: "12px", padding: "4px 8px", width: "auto", maxWidth: "260px", height: "auto" }}
                  value={rightPhoto.id}
                  onChange={(e) => setRightPhotoId(e.target.value)}
                >
                  {allPhotos.map((p) => (
                    <option key={p.id} value={p.id}>
                      Week {p.weekNumber} ({p.sessionDate}) — {p.angle}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "12px", color: "var(--accent-primary, #f97316)", fontWeight: 600 }}>
                  Week {rightPhoto.weekNumber}
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  padding: "8px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={rightPhoto.cloudinaryUrl}
                  alt={`Week ${rightPhoto.weekNumber} - ${rightPhoto.angle}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "68vh",
                    objectFit: "contain",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
