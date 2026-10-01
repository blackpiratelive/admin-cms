"use client";

import { useState, useEffect, useRef } from "react";
import { LocationRecord } from "@/db/schema";
import { createLocation, updateLocation } from "@/features/locations/actions";
import { notify } from "@/lib/notifications";
import { X, Search, Loader2, MapPin, Compass } from "lucide-react";
import type { GeocodeResult } from "@/app/api/geocode/route";

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

  // Quick GPS lookup via Mapbox
  const [findingGps, setFindingGps] = useState(false);
  const [gpsLookupMessage, setGpsLookupMessage] = useState<string | null>(null);

  // --- Location search (Mapbox forward geocoding via /api/geocode) ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setSearchError(data?.error || "Location search failed");
          setSearchResults([]);
        } else {
          setSearchResults(data.results || []);
          setSearchError(null);
          setSearchOpen(true);
          setActiveIndex(-1);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setSearchError("Location search failed");
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close the results dropdown when clicking outside the search box.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const applyGeocodeResult = (result: GeocodeResult) => {
    if (result.name) setName(result.name);
    if (result.city) setCity(result.city);
    if (result.state) setState(result.state);
    if (result.country) setCountry(result.country);
    if (typeof result.latitude === "number") setLat(String(result.latitude));
    if (typeof result.longitude === "number") setLng(String(result.longitude));
    setSearchOpen(false);
    setSearchResults([]);
    setSearchQuery("");
    setActiveIndex(-1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? searchResults.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = searchResults[activeIndex] ?? searchResults[0];
      if (pick) applyGeocodeResult(pick);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

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
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    setSearchError(null);
    setActiveIndex(-1);
    setGpsLookupMessage(null);
    setFindingGps(false);
  }, [locationToEdit, isOpen]);

  const handleLookupCoordinates = async () => {
    const query = [name.trim(), city.trim(), country.trim()].filter(Boolean).join(", ");
    if (query.length < 2) {
      setGpsLookupMessage("Please enter a location name first to search coordinates.");
      return;
    }

    setFindingGps(true);
    setGpsLookupMessage(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setGpsLookupMessage(data?.error || "Geocoding lookup failed.");
      } else {
        const results: GeocodeResult[] = (data.results || []).filter(
          (r: GeocodeResult) => typeof r.latitude === "number" && typeof r.longitude === "number"
        );
        if (results.length > 0) {
          const first = results[0];
          setLat(String(first.latitude));
          setLng(String(first.longitude));
          if (!city && first.city) setCity(first.city);
          if (!state && first.state) setState(first.state);
          if (!country && first.country) setCountry(first.country);
          setGpsLookupMessage(
            `Found coordinates for "${first.name}": ${first.latitude?.toFixed(4)}, ${first.longitude?.toFixed(4)}`
          );
        } else {
          setGpsLookupMessage(`No coordinates found on Mapbox for "${query}".`);
        }
      }
    } catch {
      setGpsLookupMessage("Failed to reach geocoding service.");
    } finally {
      setFindingGps(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Location name is required");
      return;
    }

    const locName = name.trim();
    const payload = {
      name: locName,
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

    onClose();

    notify.bg({
      title: locationToEdit ? "Update Location" : "Create Location",
      loadingMessage: `Saving location '${locName}' in background...`,
      successMessage: `Location '${locName}' saved successfully!`,
      errorMessage: (err) => `Failed to save location: ${err?.message || String(err)}`,
      task: () => (locationToEdit ? updateLocation(locationToEdit.id, payload) : createLocation(payload)),
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

        <form onSubmit={handleSubmit} className="modal-form" style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {error && (
            <div style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "10px", borderRadius: "4px", fontSize: "13px", marginBottom: "14px" }}>
              {error}
            </div>
          )}

          {/* Search a place to auto-fill the fields below */}
          <div ref={searchBoxRef} style={{ position: "relative", marginBottom: "16px" }}>
            <label className="form-label">Search for a place</label>
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: "32px" }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                placeholder="e.g. Victoria Memorial, Kolkata"
                autoComplete="off"
              />
              {searching && (
                <Loader2
                  size={15}
                  className="spin"
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
                />
              )}
            </div>
            <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
              Pick a result to auto-fill name, city, state, country, and coordinates. You can still edit everything below.
            </small>

            {searchError && (
              <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{searchError}</div>
            )}

            {searchOpen && searchResults.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  margin: "4px 0 0",
                  padding: "4px",
                  position: "absolute",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
                  maxHeight: "260px",
                  overflowY: "auto",
                }}
              >
                {searchResults.map((result, index) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => applyGeocodeResult(result)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        width: "100%",
                        textAlign: "left",
                        background: index === activeIndex ? "var(--bg-hover)" : "transparent",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 10px",
                        cursor: "pointer",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                      }}
                    >
                      <MapPin size={14} style={{ color: "var(--accent)", marginTop: "2px", flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600, display: "block" }}>{result.name}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{result.label}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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

          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span className="form-label" style={{ margin: 0 }}>Coordinates (GPS)</span>
              {(!lat || !lng) && (
                <button
                  type="button"
                  onClick={handleLookupCoordinates}
                  disabled={findingGps || !name.trim()}
                  style={{
                    background: "none",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "11px",
                    color: "var(--accent)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Search Mapbox for coordinates using location name"
                >
                  {findingGps ? <Loader2 size={11} className="spin" /> : <Compass size={11} />}
                  <span>Find GPS via Mapbox</span>
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="form-label" style={{ fontSize: "11px" }}>Latitude</label>
                <input type="number" step="any" className="form-input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="22.5448" />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: "11px" }}>Longitude</label>
                <input type="number" step="any" className="form-input" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="88.3426" />
              </div>
            </div>

            {gpsLookupMessage && (
              <div
                style={{
                  fontSize: "11px",
                  color: gpsLookupMessage.includes("Found") ? "var(--badge-published, #2e7d32)" : "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                {gpsLookupMessage}
              </div>
            )}
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
