"use client";

import { useState, useEffect } from "react";
import { getLocations, createLocation, deleteLocation } from "@/features/locations/actions";
import { LocationRecord } from "@/db/schema";
import { MapPin, Plus, Trash2, Camera, Compass, Star, Globe } from "lucide-react";

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
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <MapPin size={24} style={{ color: "var(--accent-color, #ff6600)" }} />
            <span>Locations</span>
          </h1>
          <p style={{ color: "var(--text-muted, #888)", fontSize: "14px", marginTop: "4px" }}>
            Reusable geographical entities connected to Photos, Microblogs, Trips & Media.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} />
          <span>New Location</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: "var(--card-bg, #1a1a1a)",
            border: "1px solid var(--border-color, #333)",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Add Location</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Location Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mount Fuji Fifth Station"
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Fujiyoshida"
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Japan"
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Latitude</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="35.3606"
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Longitude</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="138.7278"
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Photography Notes</label>
              <textarea
                value={photographyNotes}
                onChange={(e) => setPhotographyNotes(e.target.value)}
                placeholder="Best lighting at sunrise, heavy crowd past 10 AM..."
                className="input"
                style={{ width: "100%", marginTop: "4px", height: "60px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Camera / Gear Recs</label>
              <textarea
                value={cameraRecs}
                onChange={(e) => setCameraRecs(e.target.value)}
                placeholder="24-70mm lens, CPL filter helpful..."
                className="input"
                style={{ width: "100%", marginTop: "4px", height: "60px" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary">
              Save Location
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div>Loading locations...</div>
      ) : locs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted, #888)" }}>
          No locations created yet. Click "New Location" to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {locs.map((loc) => (
            <div
              key={loc.id}
              style={{
                backgroundColor: "var(--card-bg, #1a1a1a)",
                border: "1px solid var(--border-color, #333)",
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600 }}>{loc.name}</h3>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    style={{ background: "none", border: "none", color: "#e53e3e", cursor: "pointer" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {(loc.city || loc.country) && (
                  <div style={{ fontSize: "13px", color: "var(--text-muted, #888)", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                    <Globe size={14} />
                    <span>{[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {loc.latitude && loc.longitude && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginTop: "4px" }}>
                    GPS: {loc.latitude}, {loc.longitude}
                  </div>
                )}
                {loc.photographyNotes && (
                  <div style={{ marginTop: "12px", fontSize: "13px", backgroundColor: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent-color, #ff6600)", fontWeight: 600 }}>
                      <Camera size={12} /> Photo Notes
                    </div>
                    <div>{loc.photographyNotes}</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid var(--border-color, #333)", fontSize: "11px", color: "var(--text-muted, #888)", display: "flex", justifyContent: "space-between" }}>
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
