"use client";

import { useState, useEffect } from "react";
import { getLocations, createLocation, deleteLocation } from "@/features/locations/actions";
import { LocationRecord } from "@/db/schema";
import { MapPin, Plus, Trash2, Camera, Globe } from "lucide-react";

export default function LocationsPage() {
  const [locs, setLocs] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [photographyNotes, setPhotographyNotes] = useState("");
  const [cameraRecs, setCameraRecs] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLocations();
      setLocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createLocation({
      name: name.trim(),
      city: city.trim() || undefined,
      country: country.trim() || undefined,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      photographyNotes: photographyNotes.trim() || undefined,
      cameraRecommendations: cameraRecs.trim() || undefined,
    });

    setName("");
    setCity("");
    setCountry("");
    setLat("");
    setLng("");
    setPhotographyNotes("");
    setCameraRecs("");
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete location?")) {
      await deleteLocation(id);
      loadData();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MapPin size={20} style={{ color: "var(--accent)" }} />
            <span>Locations</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Reusable geographical entities connected to Photos, Microblogs, Trips & Media.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>New Location</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            padding: "20px",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Add Location</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Location Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mount Fuji Fifth Station"
                className="text-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Fujiyoshida"
                className="text-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Japan"
                className="text-input"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="35.3606"
                className="text-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="138.7278"
                className="text-input"
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Photography Notes</label>
              <textarea
                value={photographyNotes}
                onChange={(e) => setPhotographyNotes(e.target.value)}
                placeholder="Best lighting at sunrise, heavy crowd past 10 AM..."
                className="text-input"
                style={{ height: "60px", resize: "vertical" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Camera / Gear Recs</label>
              <textarea
                value={cameraRecs}
                onChange={(e) => setCameraRecs(e.target.value)}
                placeholder="24-70mm lens, CPL filter helpful..."
                className="text-input"
                style={{ height: "60px", resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary">
              Save Location
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading locations...</div>
      ) : locs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
          No locations created yet. Click "New Location" to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {locs.map((loc) => (
            <div
              key={loc.id}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                color: "var(--text-primary)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{loc.name}</h3>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    className="icon-button danger"
                    title="Delete location"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {(loc.city || loc.country) && (
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
                    <Globe size={14} style={{ color: "var(--text-muted)" }} />
                    <span>{[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {loc.latitude && loc.longitude && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                    GPS: {loc.latitude}, {loc.longitude}
                  </div>
                )}
                {loc.photographyNotes && (
                  <div style={{ marginTop: "12px", fontSize: "12px", backgroundColor: "var(--bg-sidebar)", padding: "8px", borderRadius: "2px", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent)", fontWeight: 600, marginBottom: "2px" }}>
                      <Camera size={12} /> Photo Notes
                    </div>
                    <div>{loc.photographyNotes}</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid var(--border-color)", fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>Visits: {loc.visitCount}</span>
                <span>Visibility: {loc.visibility}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
