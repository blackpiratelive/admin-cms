"use client";

import { useState, useEffect } from "react";
import { LocationRecord } from "@/db/schema";
import { createLocation, updateLocation } from "@/features/locations/actions";
import { X } from "lucide-react";

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationToEdit?: LocationRecord | null;
  onSuccess?: () => void;
}

export function LocationFormModal({
  isOpen,
  onClose,
  locationToEdit,
  onSuccess,
}: LocationFormModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [elevation, setElevation] = useState("");
  const [timezone, setTimezone] = useState("");
  const [photographyNotes, setPhotographyNotes] = useState("");
  const [cameraRecs, setCameraRecs] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [personalRating, setPersonalRating] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("public");
  const [favorite, setFavorite] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locationToEdit) {
      setName(locationToEdit.name || "");
      setSlug(locationToEdit.slug || "");
      setCity(locationToEdit.city || "");
      setState(locationToEdit.state || "");
      setCountry(locationToEdit.country || "");
      setLat(locationToEdit.latitude ? String(locationToEdit.latitude) : "");
      setLng(locationToEdit.longitude ? String(locationToEdit.longitude) : "");
      setElevation(locationToEdit.elevation ? String(locationToEdit.elevation) : "");
      setTimezone(locationToEdit.timezone || "");
      setPhotographyNotes(locationToEdit.photographyNotes || "");
      setCameraRecs(locationToEdit.cameraRecommendations || "");
      setPrivateNotes(locationToEdit.privateNotes || "");
      setPublicDescription(locationToEdit.publicDescription || "");
      setPersonalRating(locationToEdit.personalRating ? String(locationToEdit.personalRating) : "");
      setVisibility((locationToEdit.visibility as any) || "public");
      setFavorite(locationToEdit.favorite === 1);
    } else {
      setName("");
      setSlug("");
      setCity("");
      setState("");
      setCountry("");
      setLat("");
      setLng("");
      setElevation("");
      setTimezone("");
      setPhotographyNotes("");
      setCameraRecs("");
      setPrivateNotes("");
      setPublicDescription("");
      setPersonalRating("");
      setVisibility("public");
      setFavorite(false);
    }
    setError(null);
  }, [locationToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Location name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim() || undefined,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      elevation: elevation ? parseFloat(elevation) : undefined,
      timezone: timezone.trim() || undefined,
      photographyNotes: photographyNotes.trim() || undefined,
      cameraRecommendations: cameraRecs.trim() || undefined,
      privateNotes: privateNotes.trim() || undefined,
      publicDescription: publicDescription.trim() || undefined,
      personalRating: personalRating ? parseFloat(personalRating) : undefined,
      visibility,
      favorite: favorite ? 1 : 0,
    };

    try {
      if (locationToEdit) {
        await updateLocation(locationToEdit.id, payload);
      } else {
        await createLocation(payload);
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
          maxWidth: "640px",
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
            {locationToEdit ? `Edit Location: ${locationToEdit.name}` : "Add New Location"}
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
              <label className="form-label">Location Name *</label>
              <input type="text" className="form-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Victoria Memorial" />
            </div>
            <div>
              <label className="form-label">Custom Slug</label>
              <input type="text" className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. victoria-memorial" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">City</label>
              <input type="text" className="form-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kolkata" />
            </div>
            <div>
              <label className="form-label">State</label>
              <input type="text" className="form-input" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. West Bengal" />
            </div>
            <div>
              <label className="form-label">Country</label>
              <input type="text" className="form-input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Latitude</label>
              <input type="number" step="any" className="form-input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="22.5448" />
            </div>
            <div>
              <label className="form-label">Longitude</label>
              <input type="number" step="any" className="form-input" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="88.3426" />
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
                <span>Favorite Location</span>
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Photography Notes</label>
              <textarea className="form-input" rows={3} value={photographyNotes} onChange={(e) => setPhotographyNotes(e.target.value)} placeholder="Best light during golden hour..." />
            </div>
            <div>
              <label className="form-label">Camera Gear Recs</label>
              <textarea className="form-input" rows={3} value={cameraRecs} onChange={(e) => setCameraRecs(e.target.value)} placeholder="Wide angle 16-35mm lens recommended..." />
            </div>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label className="form-label">Private Notes</label>
            <textarea className="form-input" rows={3} value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} placeholder="Personal experience notes..." />
          </div>
        </form>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : locationToEdit ? "Update Location" : "Create Location"}
          </button>
        </div>
      </div>
    </div>
  );
}
