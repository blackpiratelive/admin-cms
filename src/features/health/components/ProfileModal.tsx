"use client";

import { useState } from "react";
import { X, Lock, Globe } from "lucide-react";
import {
  createHealthProfileAction,
  updateHealthProfileAction,
} from "../actions";
import { formatDateIso } from "../analytics";
import { notify } from "@/lib/notifications";
import type { HealthProfileRecord } from "@/db/schema";

interface ProfileModalProps {
  profile?: HealthProfileRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (profileId: string) => void;
}

export function ProfileModal({
  profile,
  isOpen,
  onClose,
  onSaved,
}: ProfileModalProps) {
  const isEditing = !!profile;
  const [name, setName] = useState(profile?.name || "");
  const [visibility, setVisibility] = useState<"private" | "public">(
    (profile?.visibility as "private" | "public") || "private"
  );
  const [baselineDate, setBaselineDate] = useState(
    profile?.baselineDate || formatDateIso()
  );
  const [notes, setNotes] = useState(profile?.notes || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profileName = name.trim();
    if (!profileName || !baselineDate) return;

    // Close modal immediately for 0ms perceived latency
    onClose();

    notify.bg({
      title: isEditing ? "Update Profile" : "Create Profile",
      loadingMessage: `Saving profile '${profileName}' in background...`,
      successMessage: `Profile '${profileName}' saved successfully!`,
      errorMessage: (err) =>
        `Failed to save profile: ${err?.message || String(err)}`,
      task: async () => {
        if (isEditing && profile) {
          const res = await updateHealthProfileAction(profile.id, {
            name: profileName,
            visibility,
            baselineDate,
            notes,
          });
          if (!res.success) throw new Error(res.error || "Update failed.");
          return profile.id;
        } else {
          const res = await createHealthProfileAction({
            name: profileName,
            visibility,
            baselineDate,
            notes,
          });
          if (!res.success || !res.profileId)
            throw new Error(res.error || "Creation failed.");
          return res.profileId;
        }
      },
      onSuccess: (savedId) => {
        onSaved(savedId);
      },
    });
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: "480px" }}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {isEditing ? "Edit Health Profile" : "Create Health Profile"}
          </h2>
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
          <div className="form-group">
            <label className="form-label" htmlFor="profile-name">
              Profile Name *
            </label>
            <input
              id="profile-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hair Regrowth Journey"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-baseline">
              Baseline Start Date *
            </label>
            <input
              id="profile-baseline"
              type="date"
              className="form-input"
              value={baselineDate}
              onChange={(e) => setBaselineDate(e.target.value)}
              required
            />
            <span
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              The date you began treatments or started taking progress photos.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Profile Privacy</label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${
                    visibility === "private"
                      ? "var(--accent-primary, #f97316)"
                      : "var(--border-color)"
                  }`,
                  background:
                    visibility === "private"
                      ? "rgba(249, 115, 22, 0.08)"
                      : "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    <Lock size={14} /> Private (Recommended)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    Only you and the Super Admin can see this profile and its
                    logs.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${
                    visibility === "public"
                      ? "var(--accent-primary, #f97316)"
                      : "var(--border-color)"
                  }`,
                  background:
                    visibility === "public"
                      ? "rgba(249, 115, 22, 0.08)"
                      : "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    <Globe size={14} /> Public
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    All logged-in CMS users can view this profile, logs, and
                    photos.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-notes">
              Notes (Optional)
            </label>
            <textarea
              id="profile-notes"
              className="form-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focusing on crown thinning and hairline restoration..."
            />
          </div>

          <div className="modal-footer" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? "Save Changes" : "Create Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
