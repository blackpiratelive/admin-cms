"use client";

import React, { useState, useEffect } from "react";
import { TripRecord } from "@/db/schema";
import { createTrip, updateTrip } from "@/features/trips/actions";
import { notify } from "@/lib/notifications";
import { X, Sparkles, Tag, Calendar, Compass, Lock } from "lucide-react";

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
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

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
      try {
        setTags(tripToEdit.tags ? JSON.parse(tripToEdit.tags) : []);
      } catch {
        setTags([]);
      }
    } else {
      setTitle("");
      setSlug("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setStatus("planned");
      setVisibility("public");
      setFavorite(false);
      setTags([]);
    }
    setTagInput("");
    setError(null);
  }, [tripToEdit, isOpen]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!tripToEdit && !slug) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, "");
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tripTitle = title.trim();
    if (!tripTitle) {
      setError("Trip title is required.");
      return;
    }

    if (tripTitle.length > 250) {
      setError("Trip title cannot exceed 250 characters.");
      return;
    }

    // Date range validation
    if (startDate && endDate) {
      if (startDate > endDate) {
        setError("Start date cannot be after end date.");
        return;
      }
    }

    const payload = {
      title: tripTitle,
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
      visibility,
      favorite: favorite ? 1 : 0,
      tags,
    };

    onClose();

    notify.bg({
      title: tripToEdit ? "Update Trip" : "Create Trip",
      loadingMessage: `Saving trip '${tripTitle}' in background...`,
      successMessage: `Trip '${tripTitle}' saved successfully!`,
      errorMessage: (err) => `Failed to save trip: ${err?.message || String(err)}`,
      task: () => (tripToEdit ? updateTrip(tripToEdit.id, payload) : createTrip(payload)),
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-form-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          backgroundColor: "var(--bg-card, #1c1c1c)",
          border: "1px solid var(--border-color, #383838)",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-color, #2e2e2e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Compass size={20} style={{ color: "var(--accent, #ff6600)" }} />
            <h2 id="trip-form-title" style={{ fontSize: "17px", fontWeight: 750, margin: 0, color: "var(--text-primary, #fff)" }}>
              {tripToEdit ? `Edit Trip: ${tripToEdit.title}` : "New Trip"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted, #888)",
              cursor: "pointer",
              padding: "4px",
            }}
            aria-label="Close form"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", flex: 1, padding: "22px" }}>
          {error && (
            <div
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                color: "#ef4444",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                marginBottom: "16px",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              {error}
            </div>
          )}

          {/* Section: Basics */}
          <div style={{ marginBottom: "18px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
              Trip Title *
            </label>
            <input
              type="text"
              className="form-input"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Durgapur-Ranchi-Delhi or Japan 2028 Exploration"
              style={{ width: "100%" }}
            />
          </div>

          {/* URL Slug */}
          <div style={{ marginBottom: "18px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
              URL Slug
            </label>
            <input
              type="text"
              className="form-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="durgapur-ranchi-delhi"
              style={{ width: "100%" }}
            />
          </div>

          {/* Section: Dates & Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
            <div>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
                <Calendar size={13} style={{ color: "var(--accent, #ff6600)" }} />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
                <Calendar size={13} style={{ color: "var(--accent, #ff6600)" }} />
                <span>End Date</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
            <div>
              <label className="form-label" style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
                Status
              </label>
              <select
                className="form-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{ width: "100%" }}
              >
                <option value="planned">Planned (Upcoming)</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
                <Lock size={13} />
                <span>Visibility</span>
              </label>
              <select
                className="form-input"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                style={{ width: "100%" }}
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          {/* Favorite */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
              />
              <span>★ Mark as Favorite Trip</span>
            </label>
          </div>

          {/* Description */}
          <div style={{ marginBottom: "18px" }}>
            <label className="form-label" style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
              Description & Notes
            </label>
            <textarea
              className="form-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief overview of the itinerary, goals, or memories..."
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginBottom: "10px" }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px", fontWeight: 600, fontSize: "13px" }}>
              <Tag size={13} />
              <span>Tags</span>
            </label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                className="form-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a tag..."
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="trip-ghost-btn"
                onClick={handleAddTag}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                Add
              </button>
            </div>

            {tags.length > 0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      background: "rgba(255,102,0,0.12)",
                      border: "1px solid rgba(255,102,0,0.25)",
                      borderRadius: "999px",
                      padding: "3px 9px",
                      fontSize: "12px",
                      color: "var(--accent, #ff6600)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <span>#{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Sticky Actions Footer */}
        <div
          style={{
            padding: "16px 22px",
            borderTop: "1px solid var(--border-color, #2e2e2e)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            backgroundColor: "rgba(0,0,0,0.15)",
          }}
        >
          <button
            type="button"
            className="trip-ghost-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="trip-primary-btn"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Saving..." : tripToEdit ? "Update Trip" : "Create Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
