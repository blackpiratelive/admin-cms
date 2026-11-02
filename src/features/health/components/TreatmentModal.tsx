"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { saveTreatmentAction } from "../actions";
import { formatDateIso } from "../analytics";
import { notify } from "@/lib/notifications";
import type { HealthTreatmentRecord } from "@/db/schema";

interface TreatmentModalProps {
  profileId: string;
  treatment?: HealthTreatmentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function TreatmentModal({
  profileId,
  treatment,
  isOpen,
  onClose,
  onSaved,
}: TreatmentModalProps) {
  const isEditing = !!treatment;
  const [name, setName] = useState(treatment?.name || "Minoxidil 5% Topical");
  const [timesPerDay, setTimesPerDay] = useState<number>(
    treatment?.timesPerDay || 2
  );
  const [startDate, setStartDate] = useState(
    treatment?.startDate || formatDateIso()
  );
  const [isActive, setIsActive] = useState<boolean>(
    treatment ? treatment.isActive === 1 : true
  );
  const [notes, setNotes] = useState(treatment?.notes || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const treatmentName = name.trim();
    if (!treatmentName) return;

    // Close modal immediately for 0ms perceived latency
    onClose();

    // Execute in background
    notify.bg({
      title: isEditing ? "Update Treatment" : "Add Treatment",
      loadingMessage: `Saving '${treatmentName}' in background...`,
      successMessage: `'${treatmentName}' saved successfully!`,
      errorMessage: (err) =>
        `Failed to save treatment: ${err?.message || String(err)}`,
      task: async () => {
        const res = await saveTreatmentAction({
          id: treatment?.id,
          profileId,
          name: treatmentName,
          timesPerDay,
          startDate,
          isActive,
          notes,
        });
        if (!res.success) {
          throw new Error(res.error || "Save failed.");
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
      <div className="modal-content" style={{ maxWidth: "460px" }}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {isEditing ? "Edit Treatment" : "Add New Treatment"}
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
            <label className="form-label" htmlFor="treatment-name">
              Treatment Name *
            </label>
            <input
              id="treatment-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Minoxidil 5% Topical, Finasteride 1mg"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="treatment-times">
              Application Frequency (Times Per Day) *
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
              }}
            >
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTimesPerDay(num)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${
                      timesPerDay === num
                        ? "var(--accent-primary, #f97316)"
                        : "var(--border-color)"
                    }`,
                    background:
                      timesPerDay === num
                        ? "rgba(249, 115, 22, 0.12)"
                        : "var(--bg-card)",
                    color:
                      timesPerDay === num
                        ? "var(--accent-primary, #f97316)"
                        : "var(--text-primary)",
                    fontWeight: timesPerDay === num ? 600 : 400,
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {num === 1
                    ? "1x Daily"
                    : num === 2
                    ? "2x (AM/PM)"
                    : `${num}x Daily`}
                </button>
              ))}
            </div>
            <span
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              Controls how many check-in doses are required per day to maintain
              your streak.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="treatment-start-date">
              Start Date *
            </label>
            <input
              id="treatment-start-date"
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          {isEditing && (
            <div className="form-group">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span style={{ fontSize: "14px", fontWeight: 500 }}>
                  Active Treatment
                </span>
              </label>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Uncheck to pause tracking this treatment without deleting
                historical logs.
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="treatment-notes">
              Instructions or Notes
            </label>
            <textarea
              id="treatment-notes"
              className="form-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1ml foam morning, 1ml liquid before bed"
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
              {isEditing ? "Update Treatment" : "Add Treatment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
