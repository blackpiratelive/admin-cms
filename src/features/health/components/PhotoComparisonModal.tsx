"use client";

import { useState } from "react";
import { X, Columns2, Maximize2, Users } from "lucide-react";
import { SCALP_ANGLES, type PhotoSessionWithPhotos, type ScalpPhotoAngle } from "../types";
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
  // Flatten all photos with their profile, session, and participant metadata
  const allPhotos = sessions.flatMap((s) =>
    s.photos.map((p) => ({
      ...p,
      profileId: s.profileId,
      profileName: s.profileName || "Profile",
      creatorUsername: s.username || s.creatorUsername || "user",
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
  const [angleFilter, setAngleFilter] = useState<string>("all");

  if (!isOpen || allPhotos.length === 0) return null;

  const filteredPhotos =
    angleFilter === "all"
      ? allPhotos
      : allPhotos.filter((p) => p.angle === angleFilter);

  const photosForSelection =
    filteredPhotos.length > 0 ? filteredPhotos : allPhotos;

  const leftPhoto =
    allPhotos.find((p) => p.id === leftPhotoId) || photosForSelection[0] || allPhotos[0];
  const rightPhoto =
    allPhotos.find((p) => p.id === rightPhotoId) ||
    photosForSelection[1] ||
    leftPhoto;

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 1200,
        background: "rgba(0, 0, 0, 0.9)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: "1150px",
          width: "96vw",
          maxHeight: "95vh",
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
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "12px",
            paddingBottom: "10px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>
              Scalp Progress & Peer Comparison
            </h2>
            {allPhotos.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => setIsSplitMode(!isSplitMode)}
              >
                {isSplitMode ? <Maximize2 size={13} /> : <Columns2 size={13} />}
                <span>{isSplitMode ? "Single View" : "Side-by-Side Compare"}</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Quick Angle Filter */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Filter Angle:
              </span>
              <select
                className="form-input"
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  width: "auto",
                  height: "auto",
                }}
                value={angleFilter}
                onChange={(e) => setAngleFilter(e.target.value)}
              >
                <option value="all">All Angles</option>
                {SCALP_ANGLES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
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
        </div>

        {/* Viewport Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isSplitMode ? "1fr 1fr" : "1fr",
            gap: "16px",
            flex: 1,
            minHeight: "380px",
            overflow: "hidden",
          }}
        >
          {/* Left Photo Card */}
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
                background: "rgba(255, 255, 255, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <select
                className="form-input"
                style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  width: "auto",
                  maxWidth: "320px",
                  height: "auto",
                }}
                value={leftPhoto.id}
                onChange={(e) => setLeftPhotoId(e.target.value)}
              >
                {photosForSelection.map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.creatorUsername} • Week {p.weekNumber} ({p.angle.replace("_", " ")})
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(249, 115, 22, 0.15)",
                    color: "var(--accent-primary, #f97316)",
                  }}
                >
                  @{leftPhoto.creatorUsername}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                  Week {leftPhoto.weekNumber}
                </span>
              </div>
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
                alt={`@${leftPhoto.creatorUsername} Week ${leftPhoto.weekNumber} - ${leftPhoto.angle}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "68vh",
                  objectFit: "contain",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          {/* Right Photo Card (in Split Mode) */}
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
                  background: "rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <select
                  className="form-input"
                  style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    width: "auto",
                    maxWidth: "320px",
                    height: "auto",
                  }}
                  value={rightPhoto.id}
                  onChange={(e) => setRightPhotoId(e.target.value)}
                >
                  {photosForSelection.map((p) => (
                    <option key={p.id} value={p.id}>
                      @{p.creatorUsername} • Week {p.weekNumber} ({p.angle.replace("_", " ")})
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "var(--accent-blue, #3b82f6)",
                    }}
                  >
                    @{rightPhoto.creatorUsername}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                    Week {rightPhoto.weekNumber}
                  </span>
                </div>
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
                  alt={`@${rightPhoto.creatorUsername} Week ${rightPhoto.weekNumber} - ${rightPhoto.angle}`}
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
