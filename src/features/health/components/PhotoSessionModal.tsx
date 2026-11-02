"use client";

import { useState } from "react";
import { X, Upload, Camera, Trash2 } from "lucide-react";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { savePhotoSessionAction } from "../actions";
import { calculateWeekNumber, formatDateIso } from "../analytics";
import { SCALP_ANGLES, type ScalpPhotoAngle } from "../types";

interface PhotoSessionModalProps {
  profileId: string;
  baselineDate: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  angle: ScalpPhotoAngle;
}

export function PhotoSessionModal({
  profileId,
  baselineDate,
  isOpen,
  onClose,
  onSaved,
}: PhotoSessionModalProps) {
  const [sessionDate, setSessionDate] = useState(formatDateIso());
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const weekNumber = calculateWeekNumber(baselineDate, sessionDate);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles = Array.from(e.target.files);

    const defaultAngles: ScalpPhotoAngle[] = [
      "crown",
      "hairline",
      "left_temple",
      "right_temple",
      "top",
      "overall",
    ];

    const currentCount = photos.length;
    const addedPhotos: PendingPhoto[] = newFiles.map((file, idx) => ({
      id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      angle: defaultAngles[(currentCount + idx) % defaultAngles.length],
    }));

    setPhotos((prev) => [...prev, ...addedPhotos]);
    e.target.value = ""; // reset
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleAngleChange = (id: string, angle: ScalpPhotoAngle) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, angle } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      setError("Please select or take at least one scalp photo.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // 1. Upload photos to Cloudinary
      const uploadedPhotos: {
        angle: ScalpPhotoAngle;
        cloudinaryUrl: string;
        cloudinaryPublicId: string;
      }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const item = photos[i];
        setProgressMsg(`Uploading photo ${i + 1} of ${photos.length}...`);

        const uploadRes = await uploadDirectToCloudinary(item.file);
        uploadedPhotos.push({
          angle: item.angle,
          cloudinaryUrl: uploadRes.secure_url,
          cloudinaryPublicId: uploadRes.public_id,
        });
      }

      // 2. Save session and photos in DB
      setProgressMsg("Saving session to database...");
      const res = await savePhotoSessionAction({
        profileId,
        sessionDate,
        weekNumber,
        notes,
        photos: uploadedPhotos,
      });

      if (!res.success) {
        setError(res.error || "Failed to save photo session.");
        setUploading(false);
        return;
      }

      // Clean up object URLs
      for (const p of photos) {
        URL.revokeObjectURL(p.previewUrl);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || "An error occurred while uploading photos.");
    } finally {
      setUploading(false);
      setProgressMsg(null);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
              New Scalp Photo Session
            </h2>
            <div style={{ fontSize: "12px", color: "var(--accent-primary, #f97316)", marginTop: "2px" }}>
              Week {weekNumber} since baseline
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            disabled={uploading}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid var(--danger-color, #ef4444)",
                color: "var(--danger-color, #ef4444)",
                borderRadius: "6px",
                padding: "10px 12px",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="session-date">
              Session Date *
            </label>
            <input
              id="session-date"
              type="date"
              className="form-input"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              disabled={uploading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Add Scalp Photos (Mobile Camera or Files)</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "6px",
              }}
            >
              {/* Direct Camera Button for Mobile */}
              <label
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontSize: "13px",
                }}
              >
                <Camera size={16} />
                <span>Take Photo (Camera)</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFilesSelected}
                  disabled={uploading}
                />
              </label>

              {/* Browse / Gallery Button */}
              <label
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontSize: "13px",
                }}
              >
                <Upload size={16} />
                <span>Choose Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFilesSelected}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Photos Preview List */}
          {photos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                Selected Photos ({photos.length}):
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: "12px",
                }}
              >
                {photos.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      overflow: "hidden",
                      background: "var(--bg-card)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ position: "relative", width: "100%", height: "110px", background: "#000" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt="Scalp Preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        disabled={uploading}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          background: "rgba(0, 0, 0, 0.6)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px",
                          cursor: "pointer",
                        }}
                        aria-label="Remove photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ padding: "6px" }}>
                      <select
                        className="form-input"
                        style={{ fontSize: "11px", padding: "4px 6px", height: "auto" }}
                        value={item.angle}
                        onChange={(e) =>
                          handleAngleChange(item.id, e.target.value as ScalpPhotoAngle)
                        }
                        disabled={uploading}
                      >
                        {SCALP_ANGLES.map((angle) => (
                          <option key={angle.value} value={angle.value}>
                            {angle.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="session-notes">
              Session Notes (Optional)
            </label>
            <textarea
              id="session-notes"
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Scalp looking calmer, noticeable baby hairs along temple..."
              disabled={uploading}
            />
          </div>

          <div className="modal-footer" style={{ marginTop: "16px" }}>
            {progressMsg && (
              <span style={{ fontSize: "12px", color: "var(--accent-primary, #f97316)", marginRight: "auto" }}>
                {progressMsg}
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || photos.length === 0}
            >
              {uploading ? "Uploading..." : `Upload & Save (${photos.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
