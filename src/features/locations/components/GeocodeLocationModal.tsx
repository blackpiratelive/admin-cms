"use client";

import { useState, useEffect, useRef } from "react";
import { LocationRecord } from "@/db/schema";
import { updateLocationCoordinatesAction } from "@/features/locations/actions";
import { notify } from "@/lib/notifications";
import { X, Search, Loader2, MapPin, Check, AlertCircle, Compass } from "lucide-react";
import type { GeocodeResult } from "@/app/api/geocode/route";

interface GeocodeLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationRecord | null;
  onSuccess?: (updated: LocationRecord) => void;
}

export function GeocodeLocationModal({
  isOpen,
  onClose,
  location,
  onSuccess,
}: GeocodeLocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<GeocodeResult | null>(null);
  const [updateAddress, setUpdateAddress] = useState(true);
  const [saving, setSaving] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Initialize search query from location data when modal opens
  useEffect(() => {
    if (isOpen && location) {
      const parts = [location.name, location.city, location.country].filter(Boolean);
      const initialQuery = parts.join(", ");
      setSearchQuery(initialQuery);
      setSelectedResult(null);
      setSearchError(null);
      setUpdateAddress(true);

      // Trigger initial search if query is valid
      if (initialQuery.trim().length >= 2) {
        performSearch(initialQuery.trim());
      }

      // Focus the input
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedResult(null);
      setSearchError(null);
    }
  }, [isOpen, location]);

  const performSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
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
        const results: GeocodeResult[] = (data.results || []).filter(
          (r: GeocodeResult) => typeof r.latitude === "number" && typeof r.longitude === "number"
        );
        setSearchResults(results);
        if (results.length > 0) {
          // Pre-select first result for quick preview
          setSelectedResult(results[0]);
        } else {
          setSelectedResult(null);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setSearchError("Failed to connect to location search service.");
        setSearchResults([]);
      }
    } finally {
      setSearching(false);
    }
  };

  // Debounced input change
  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
    const query = text.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSelectedResult(null);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearch(searchQuery.trim());
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSaveCoordinates = () => {
    if (!location || !selectedResult) return;
    if (typeof selectedResult.latitude !== "number" || typeof selectedResult.longitude !== "number") {
      return;
    }

    const lat = selectedResult.latitude;
    const lng = selectedResult.longitude;

    const payload = {
      latitude: lat,
      longitude: lng,
      ...(updateAddress && selectedResult.city ? { city: selectedResult.city } : {}),
      ...(updateAddress && selectedResult.state ? { state: selectedResult.state } : {}),
      ...(updateAddress && selectedResult.country ? { country: selectedResult.country } : {}),
    };

    onClose();

    notify.bg({
      title: "Save Coordinates",
      loadingMessage: `Saving coordinates for '${location.name}'...`,
      successMessage: `GPS coordinates updated to ${lat.toFixed(4)}, ${lng.toFixed(4)}!`,
      errorMessage: (err) => `Failed to save coordinates: ${err?.message || String(err)}`,
      task: async () => {
        const res = await updateLocationCoordinatesAction(location.id, payload);
        if (!res.success || !res.location) {
          throw new Error(res.error || "Failed to update location coordinates");
        }
        return res.location;
      },
      onSuccess: (updatedLoc) => {
        onSuccess?.(updatedLoc);
      },
    });
  };

  if (!isOpen || !location) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 10000,
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
          maxWidth: "600px",
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
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={18} style={{ color: "var(--accent)" }} />
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              Search Coordinates with Mapbox
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Target Location Banner */}
          <div
            style={{
              backgroundColor: "var(--bg-hover)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {location.name}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                {[location.city, location.state, location.country].filter(Boolean).join(", ") || "No address specified"}
              </div>
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "#f59e0b",
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              Missing Coordinates
            </span>
          </div>

          {/* Search Input Bar */}
          <div>
            <label className="form-label" style={{ marginBottom: "6px" }}>
              Search query on Mapbox:
            </label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                ref={inputRef}
                type="text"
                className="form-input"
                style={{ paddingLeft: "36px", paddingRight: "36px" }}
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search place, city, or address..."
              />
              {searching && (
                <Loader2
                  size={16}
                  className="spin"
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--accent)",
                  }}
                />
              )}
            </div>
            <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "4px", display: "block" }}>
              Press Enter or type to search forward geocoding results via Mapbox.
            </small>
          </div>

          {/* Error Message */}
          {searchError && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "#ef4444",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Location search error:</strong> {searchError}
                {searchError.includes("MAPBOX_TOKEN") && (
                  <div style={{ fontSize: "11px", marginTop: "4px", color: "var(--text-secondary)" }}>
                    To configure, add <code>MAPBOX_TOKEN=your_token</code> to your <code>.env.local</code> file and restart the development server.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results List */}
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              Places found ({searchResults.length})
            </div>

            {searchResults.length === 0 && !searching && !searchError && (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  backgroundColor: "var(--bg-hover)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                }}
              >
                No places found for &quot;{searchQuery}&quot;. Try adjusting the search terms.
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "220px",
                overflowY: "auto",
              }}
            >
              {searchResults.map((result) => {
                const isSelected = selectedResult?.id === result.id;
                return (
                  <div
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "6px",
                      border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border-color)",
                      backgroundColor: isSelected ? "var(--bg-hover)" : "var(--bg-card)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin
                          size={14}
                          style={{ color: isSelected ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                          {result.name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                          marginTop: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {result.label}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      {result.latitude !== undefined && result.longitude !== undefined && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-color)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                        </span>
                      )}
                      {isSelected && <Check size={16} style={{ color: "var(--accent)" }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Result Preview & Options */}
          {selectedResult && (
            <div
              style={{
                backgroundColor: "var(--bg-hover)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)" }}>
                Coordinates to Save:
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-primary)",
                }}
              >
                <span>
                  <strong>Latitude:</strong> {selectedResult.latitude}
                </span>
                <span>
                  <strong>Longitude:</strong> {selectedResult.longitude}
                </span>
              </div>

              {(selectedResult.city || selectedResult.country) && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginTop: "4px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={updateAddress}
                    onChange={(e) => setUpdateAddress(e.target.checked)}
                  />
                  <span>
                    Also fill address fields:{" "}
                    {[selectedResult.city, selectedResult.state, selectedResult.country]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveCoordinates}
            disabled={!selectedResult || saving}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Compass size={14} />
            <span>Save Coordinates</span>
          </button>
        </div>
      </div>
    </div>
  );
}
