"use client";

import { useState } from "react";
import { X, Upload, Camera, Trash2 } from "lucide-react";
import { uploadDirectToCloudinary } from "@/lib/cloudinary";
import { savePhotoSessionAction } from "../actions";
import { calculateWeekNumber, formatDateIso } from "../analytics";
import { notify } from "@/lib/notifications";
import { SCALP_ANGLES, type ScalpPhotoAngle, type ParticipantSummary } from "../types";

interface PhotoSessionModalProps {
  profileId: string;
  baselineDate: string;
  participants: ParticipantSummary[];
  currentUserId: string;
  isSuperAdmin: boolean;
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
  participants,
  currentUserId,
  isSuperAdmin,
  isOpen,
  onClose,
  onSaved,
}: PhotoSessionModalProps) {
  const [sessionDate, setSessionDate] = useState(formatDateIso());
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Default target participant to current user if available, else first participant
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>(() => {
    const self = participants.find((p) => p.userId === currentUserId);
    return self?.userId || participants[0]?.userId || currentUserId;
  });

  if (!isOpen) return null;

  const weekNumber = calculateWeekNumber(baselineDate, sessionDate);
  const targetParticipant =
    participants.find((p) => p.userId === selectedTargetUserId) || participants[0];

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (photos.length === 0) {
      setError("Please select or take at least one scalp photo.");
      return;
    }

    const photosToUpload = [...photos];
    const sDate = sessionDate;
    const sNotes = notes;
    const sWeek = weekNumber;
    const tUserId = selectedTargetUserId;
    const tUsername = targetParticipant?.username || "participant";

    // Close modal immediately for 0ms perceived latency
    onClose();

    // Run upload and DB write in background
    notify.bg({
      title: "Scalp Photo Session",
      loadingMessage: `Uploading ${photosToUpload.length} scalp photos for @${tUsername} in background...`,
      successMessage: `Week ${sWeek} photo session for @${tUsername} saved!`,
      errorMessage: (err) =>
        `Failed to upload photo session: ${err?.message || String(err)}`,
      task: async () => {
        const uploadedPhotos: {
          angle: ScalpPhotoAngle;
          cloudinaryUrl: string;
          cloudinaryPublicId: string;
        }[] = [];

        for (const item of photosToUpload) {
          const uploadRes = await uploadDirectToCloudinary(item.file);
          uploadedPhotos.push({
            angle: item.angle,
            cloudinaryUrl: uploadRes.secure_url,
            cloudinaryPublicId: uploadRes.public_id,
          });
        }

        const res = await savePhotoSessionAction({
          profileId,
          targetUserId: tUserId,
          targetUsername: tUsername,
          sessionDate: sDate,
          weekNumber: sWeek,
          notes: sNotes,
          photos: uploadedPhotos,
        });

        if (!res.success) {
          throw new Error(res.error || "Failed to save photo session in DB.");
        }

        // Clean up object URLs
        for (const p of photosToUpload) {
          URL.revokeObjectURL(p.previewUrl);
        }

        return res;
      },
      onSuccess: () => {
        onSaved();
      },
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
              New Scalp Photo Session
            </h2>
            <div
              style={{
                fontSize: "12px",
                color: "var(--accent-primary, #f97316)",
                marginTop: "2px",
              }}
            >
              Week {weekNumber} since baseline
            </div>
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

          {/* Participant Selector (if multiple participants or superadmin) */}
          {participants.length > 1 && (
            <div className="form-group">
              <label className="form-label" htmlFor="participant-select">
                Scalp Photos For Participant
              </label>
              <select
                id="participant-select"
                className="form-input"
                value={selectedTargetUserId}
                onChange={(e) => setSelectedTargetUserId(e.target.value)}
                disabled={!isSuperAdmin && participants.some((p) => p.userId === currentUserId)}
              >
                {participants.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    @{p.username} {p.isOwner ? "(Owner)" : "(Collaborator)"}
                  </option>
                ))}
              </select>
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
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Add Scalp Photos (Mobile Camera or Files)
            </label>
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
                  cursor: "pointer",
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
                />
              </label>

              {/* Browse / Gallery Button */}
              <label
                className="btn btn-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                <Upload size={16} />
                <span>Choose Files</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFilesSelected}
                />
              </label>
            </div>
          </div>

          {/* Photos Preview Grid */}
          {photos.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                Selected Photos ({photos.length}) — Label Angles
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                  gap: "12px",
                  marginTop: "8px",
                }}
              >
                {photos.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--bg-main)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "6px",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        paddingTop: "100%",
                        borderRadius: "4px",
                        overflow: "hidden",
                        background: "#000",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.previewUrl}
                        alt="Scalp Preview"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          background: "rgba(0,0,0,0.65)",
                          border: "none",
                          color: "#fff",
                          borderRadius: "4px",
                          padding: "3px",
                          cursor: "pointer",
                        }}
                        aria-label="Remove photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <select
                      className="form-input"
                      value={item.angle}
                      onChange={(e) =>
                        handleAngleChange(
                          item.id,
                          e.target.value as ScalpPhotoAngle
                        )
                      }
                      style={{ fontSize: "11px", padding: "4px 6px" }}
                    >
                      {SCALP_ANGLES.map((ang) => (
                        <option key={ang.value} value={ang.value}>
                          {ang.label}
                        </option>
                      ))}
                    </select>
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
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Shedding reduced, vellus hairs noticed on hairline..."
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={photos.length === 0}
            >
              Save & Upload ({photos.length})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
