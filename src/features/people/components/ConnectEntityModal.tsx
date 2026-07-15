"use client";

import { useState, useEffect } from "react";
import { connectPersonToEntityAction } from "@/features/people/actions";
import { addItemToCollectionAction, getCollectionsAction } from "@/features/libraries/actions/collections";
import { CollectionRecord } from "@/db/schema";
import { X, Link2, Plus } from "lucide-react";

interface ConnectEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  onSuccess?: () => void;
  // Available entities to select from
  allLocations?: Array<{ id: string; name: string }>;
  allTrips?: Array<{ id: string; title: string }>;
  allProjects?: Array<{ id: string; name: string }>;
  allMicroblogs?: Array<{ id: string; slug: string; contentMarkdown: string }>;
  allPhotos?: Array<{ id: string; title: string }>;
}

export function ConnectEntityModal({
  isOpen,
  onClose,
  personId,
  personName,
  onSuccess,
  allLocations = [],
  allTrips = [],
  allProjects = [],
  allMicroblogs = [],
  allPhotos = [],
}: ConnectEntityModalProps) {
  const [targetType, setTargetType] = useState<"location" | "trip" | "project" | "microblog" | "gallery" | "collection">("location");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("");
  const [availableCollections, setAvailableCollections] = useState<CollectionRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getCollectionsAction().then((cols) => setAvailableCollections(cols));
      setSelectedTargetId("");
      setRelationshipLabel("visited");
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (targetType === "location") setRelationshipLabel("visited");
    else if (targetType === "trip") setRelationshipLabel("joined");
    else if (targetType === "project") setRelationshipLabel("worked_on");
    else if (targetType === "microblog") setRelationshipLabel("mentions");
    else if (targetType === "gallery") setRelationshipLabel("appears_in");
    else if (targetType === "collection") setRelationshipLabel("member");
  }, [targetType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) {
      setError("Please select an item to connect.");
      return;
    }

    setSaving(true);
    setError(null);

    let res;
    if (targetType === "collection") {
      res = await addItemToCollectionAction(selectedTargetId, "person", personId);
    } else {
      res = await connectPersonToEntityAction(
        personId,
        targetType,
        selectedTargetId,
        relationshipLabel.trim() || "connected_to"
      );
    }

    setSaving(false);

    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      const errMsg = "error" in res ? (res as { error?: string }).error : undefined;
      setError(errMsg || "Failed to create connection");
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
          maxWidth: "480px",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link2 size={16} style={{ color: "var(--accent)" }} />
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
              Connect {personName}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "18px" }}>
          {error && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                padding: "8px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                marginBottom: "12px",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: "14px" }}>
            <label className="form-label">Connection Entity Type</label>
            <select
              className="form-input"
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as any);
                setSelectedTargetId("");
              }}
            >
              <option value="location">Location (Visited Place)</option>
              <option value="trip">Trip (Travel Itinerary)</option>
              <option value="gallery">Photo (Appears In Photo)</option>
              <option value="microblog">Microblog (Mentioned In Post)</option>
              <option value="project">Project (Worked On Project)</option>
              <option value="collection">Collection (Belongs To Group)</option>
            </select>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label className="form-label">
              Select {targetType.charAt(0).toUpperCase() + targetType.slice(1)}
            </label>
            <select
              className="form-input"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              required
            >
              <option value="">-- Choose item --</option>
              {targetType === "location" &&
                allLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              {targetType === "trip" &&
                allTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              {targetType === "gallery" &&
                allPhotos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              {targetType === "microblog" &&
                allMicroblogs.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.slug} - {m.contentMarkdown.slice(0, 40)}...
                  </option>
                ))}
              {targetType === "project" &&
                allProjects.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              {targetType === "collection" &&
                availableCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {targetType !== "collection" && (
            <div style={{ marginBottom: "16px" }}>
              <label className="form-label">Relationship Verb / Label</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. visited, joined, worked_on, appears_in..."
                value={relationshipLabel}
                onChange={(e) => setRelationshipLabel(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Connecting..." : "Add Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
