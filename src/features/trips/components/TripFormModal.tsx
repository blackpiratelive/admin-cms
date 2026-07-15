"use client";

import { useState, useEffect } from "react";
import { TripRecord } from "@/db/schema";
import { createTrip, updateTrip } from "@/features/trips/actions";
import { X } from "lucide-react";

interface TripFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripToEdit?: TripRecord | null;
  onSuccess?: () => void;
}

export function TripFormModal({
  isOpen,
  onClose,
  tripToEdit,
  onSuccess,
}: TripFormModalProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"planned" | "ongoing" | "completed" | "cancelled">("planned");
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("public");
  const [favorite, setFavorite] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tripToEdit) {
      setTitle(tripToEdit.title || "");
      setSlug(tripToEdit.slug || "");
      setDescription(tripToEdit.description || "");
      setStartDate(tripToEdit.startDate || "");
      setEndDate(tripToEdit.endDate || "");
      setStatus((tripToEdit.status as any) || "planned");
      setVisibility((tripToEdit.visibility as any) || "public");
      setFavorite(tripToEdit.favorite === 1);
    } else {
      setTitle("");
      setSlug("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setStatus("planned");
      setVisibility("public");
      setFavorite(false);
    }
    setError(null);
  }, [tripToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Trip title is required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
      visibility,
      favorite: favorite ? 1 : 0,
    };

    try {
      if (tripToEdit) {
        await updateTrip(tripToEdit.id, payload);
      } else {
        await createTrip(payload);
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
            {tripToEdit ? `Edit Trip: ${tripToEdit.title}` : "Add New Trip"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {error && (
            <div style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "10px", borderRadius: "4px", fontSize: "13px", marginBottom: "14px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Trip Title *</label>
              <input type="text" className="form-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Japan 2028 Exploration" />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Visibility</label>
              <select className="form-input" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", paddingTop: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
                <span>Favorite Trip</span>
              </label>
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Overview of itinerary, journey notes..." />
          </div>
        </form>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : tripToEdit ? "Update Trip" : "Create Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
