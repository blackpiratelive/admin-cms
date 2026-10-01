"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MapPin, Navigation, AlertCircle, ExternalLink, Map as MapIcon } from "lucide-react";
import { getTripMapLocationsAction, getMapboxTokenAction } from "@/features/trips/actions";
import type { TripLocationCoordinate } from "@/features/trips/types";
import { MapboxTripMap } from "./MapboxTripMap";

interface TripMapTabProps {
  tripSlugOrId: string;
}

export function TripMapTab({ tripSlugOrId }: TripMapTabProps) {
  const [loading, setLoading] = useState(true);
  const [orderedLocations, setOrderedLocations] = useState<TripLocationCoordinate[]>([]);
  const [missingCoords, setMissingCoords] = useState<TripLocationCoordinate[]>([]);
  const [routeStops, setRouteStops] = useState<TripLocationCoordinate[]>([]);
  const [associatedLocations, setAssociatedLocations] = useState<TripLocationCoordinate[]>([]);
  const [selectedPin, setSelectedPin] = useState<TripLocationCoordinate | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapboxFailed, setMapboxFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [res, token] = await Promise.all([
          getTripMapLocationsAction(tripSlugOrId),
          getMapboxTokenAction(),
        ]);
        if (isMounted) {
          setOrderedLocations(res.orderedLocations);
          setRouteStops(res.routeStops || res.orderedLocations);
          setAssociatedLocations(res.associatedLocations || []);
          setMissingCoords(res.missingCoords);
          setMapboxToken(token);
          if (res.orderedLocations.length > 0) {
            setSelectedPin(res.orderedLocations[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load trip map data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [tripSlugOrId]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted, #888)" }}>
        Loading trip route map...
      </div>
    );
  }

  // Calculate bounding box for SVG projection
  const hasCoordinates = orderedLocations.length > 0;

  let minLat = 90,
    maxLat = -90,
    minLon = 180,
    maxLon = -180;

  for (const loc of orderedLocations) {
    if (loc.latitude !== null && loc.longitude !== null) {
      if (loc.latitude < minLat) minLat = loc.latitude;
      if (loc.latitude > maxLat) maxLat = loc.latitude;
      if (loc.longitude < minLon) minLon = loc.longitude;
      if (loc.longitude > maxLon) maxLon = loc.longitude;
    }
  }

  // Add padding
  const latSpan = Math.max(0.04, (maxLat - minLat) * 1.3);
  const lonSpan = Math.max(0.04, (maxLon - minLon) * 1.3);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  // ViewBox dimensions: 800 x 420
  const svgWidth = 800;
  const svgHeight = 420;

  const projectToSvg = (lat: number, lon: number): { x: number; y: number } => {
    // Equirectangular projection centered
    const x = svgWidth / 2 + ((lon - centerLon) / lonSpan) * (svgWidth * 0.8);
    const y = svgHeight / 2 - ((lat - centerLat) / latSpan) * (svgHeight * 0.75);
    return {
      x: Math.min(svgWidth - 40, Math.max(40, x)),
      y: Math.min(svgHeight - 40, Math.max(40, y)),
    };
  };

  const projectedPoints = orderedLocations.map((loc) => ({
    ...loc,
    pt: projectToSvg(loc.latitude!, loc.longitude!),
  }));

  // Build SVG path specifically for the itinerary route
  const routePoints = projectedPoints.filter((p) => p.stopType !== "associated");
  const linePoints = routePoints.length >= 2 ? routePoints : projectedPoints;

  // Draw gently-curved connectors (quadratic Béziers) instead of bare straight
  // segments, each bowed to the same side so the route reads as one flowing path.
  const buildCurvedPath = (pts: typeof linePoints): string => {
    if (pts.length < 2) {
      return pts.length === 1 ? `M ${pts[0].pt.x} ${pts[0].pt.y}` : "";
    }
    let d = `M ${pts[0].pt.x.toFixed(2)} ${pts[0].pt.y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].pt;
      const b = pts[i + 1].pt;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.001) {
        d += ` L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
        continue;
      }
      const nx = -dy / dist;
      const ny = dx / dist;
      const offset = dist * 0.15;
      const cx = (a.x + b.x) / 2 + nx * offset;
      const cy = (a.y + b.y) / 2 + ny * offset;
      d += ` Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    }
    return d;
  };
  const pathD = buildCurvedPath(linePoints);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Map visual surface */}
      {hasCoordinates ? (
        mapboxToken && !mapboxFailed ? (
          <MapboxTripMap
            locations={orderedLocations}
            token={mapboxToken}
            selectedPin={selectedPin}
            onSelectPin={setSelectedPin}
            onError={(err) => {
              console.warn("Mapbox GL initialization failed, falling back to SVG vector visualizer:", err);
              setMapboxFailed(true);
            }}
          />
        ) : (
          <div>
            {!mapboxToken && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--text-muted, #888)",
                  marginBottom: "8px",
                  padding: "6px 10px",
                  background: "rgba(255, 102, 0, 0.05)",
                  border: "1px solid rgba(255, 102, 0, 0.15)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MapIcon size={14} style={{ color: "var(--accent, #ff6600)" }} />
                  <span>Displaying vector route visualizer</span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted, #777)" }}>
                  Configure <code style={{ color: "var(--accent, #ff6600)" }}>MAPBOX_TOKEN</code> in <code style={{ color: "var(--accent, #ff6600)" }}>.env.local</code> to enable interactive 3D satellite & street maps
                </span>
              </div>
            )}
            <div className="trip-map-container" aria-label="Route projection map">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                style={{ width: "100%", height: "100%", display: "block" }}
              >
                <defs>
                  <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent, #ff6600)" />
                    <stop offset="50%" stopColor="#ffb15f" />
                    <stop offset="100%" stopColor="var(--accent, #ff6600)" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Subtle background coordinate grid lines */}
                <line x1="0" y1="140" x2={svgWidth} y2="140" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 6" />
                <line x1="0" y1="280" x2={svgWidth} y2="280" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 6" />
                <line x1="260" y1="0" x2="260" y2={svgHeight} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 6" />
                <line x1="540" y1="0" x2="540" y2={svgHeight} stroke="rgba(255,255,255,0.03)" strokeDasharray="4 6" />

                {/* Route line */}
                {linePoints.length > 1 && (
                  <>
                    {/* Route shadow/glow */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="rgba(255, 102, 0, 0.3)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Route main line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="url(#routeGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 4"
                    />
                  </>
                )}

                {/* Pins */}
                {projectedPoints.map((p, idx) => {
                  const isSelected = selectedPin?.id === p.id;
                  const isAssoc = !!p.isAssociatedLocation;
                  const isWaypoint = p.stopType === "transport_waypoint";
                  return (
                    <g
                      key={p.id}
                      onClick={() => setSelectedPin(p)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Outer pulse circle */}
                      <circle
                        cx={p.pt.x}
                        cy={p.pt.y}
                        r={isSelected ? 14 : isWaypoint ? 7 : 10}
                        fill={isAssoc ? "rgba(245, 158, 11, 0.25)" : isWaypoint ? "rgba(255, 142, 77, 0.2)" : "rgba(255, 102, 0, 0.2)"}
                        filter="url(#glow)"
                      />
                      {/* Inner pin circle */}
                      <circle
                        cx={p.pt.x}
                        cy={p.pt.y}
                        r={isSelected ? 8 : isWaypoint ? 4 : 6}
                        fill={isAssoc ? "#f59e0b" : isWaypoint ? "#ff8e4d" : "var(--accent, #ff6600)"}
                        stroke={isAssoc ? "#fef3c7" : "#ffffff"}
                        strokeWidth="1.5"
                      />
                      {/* Order Number Badge */}
                      {!isWaypoint && (
                        <text
                          x={p.pt.x}
                          y={p.pt.y - 12}
                          textAnchor="middle"
                          fill={isAssoc ? "#fef3c7" : "#ffffff"}
                          fontSize="10"
                          fontWeight="bold"
                          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                        >
                          {isAssoc && p.stopType === "associated" ? "★" : p.order}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* HTML Overlay Pin Labels */}
              {projectedPoints.map((p) => {
                const isSelected = selectedPin?.id === p.id;
                const isAssoc = !!p.isAssociatedLocation;
                const pctX = (p.pt.x / svgWidth) * 100;
                const pctY = (p.pt.y / svgHeight) * 100;

                return (
                  <div
                    key={`label-${p.id}`}
                    className="trip-map-label"
                    style={{
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      borderColor: isSelected
                        ? isAssoc
                          ? "#f59e0b"
                          : "var(--accent, #ff6600)"
                        : isAssoc
                        ? "rgba(245, 158, 11, 0.4)"
                        : "#3a3a3a",
                      color: isAssoc ? "#fef3c7" : "#eeeeee",
                      boxShadow: isSelected
                        ? isAssoc
                          ? "0 0 14px rgba(245, 158, 11, 0.5)"
                          : "0 0 12px rgba(255, 102, 0, 0.35)"
                        : "none",
                    }}
                  >
                    {isAssoc && <span style={{ marginRight: "3px" }}>★</span>}
                    {p.name}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="trip-empty-box" style={{ padding: "40px 20px" }}>
          <MapPin size={32} style={{ color: "var(--accent, #ff6600)", margin: "0 auto 12px" }} />
          <strong className="trip-empty-title">No Map Coordinates Available</strong>
          <p className="trip-empty-desc">
            The locations connected to this trip do not have latitude and longitude recorded yet. Edit the itinerary days or location entities to add coordinates and view the travel route.
          </p>
        </div>
      )}

      {/* Selected location detail callout */}
      {selectedPin && (
        <div
          style={{
            backgroundColor: "var(--bg-card, #1c1c1c)",
            border: `1px solid ${
              selectedPin.isAssociatedLocation ? "rgba(245, 158, 11, 0.5)" : "var(--border-color, #343434)"
            }`,
            borderRadius: "10px",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: selectedPin.isAssociatedLocation
                  ? "#f59e0b"
                  : selectedPin.stopType === "transport_waypoint"
                  ? "#ff8e4d"
                  : "var(--accent, #ff6600)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontWeight: "bold",
                fontSize: "12px",
                boxShadow: selectedPin.isAssociatedLocation
                  ? "0 0 12px rgba(245, 158, 11, 0.6)"
                  : "none",
              }}
            >
              {selectedPin.isAssociatedLocation && selectedPin.stopType === "associated"
                ? "★"
                : selectedPin.stopType === "transport_waypoint"
                ? "•"
                : selectedPin.order}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary, #fff)" }}>
                  {selectedPin.name}
                </span>
                {selectedPin.isAssociatedLocation && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#f59e0b",
                      backgroundColor: "rgba(245, 158, 11, 0.15)",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    ⭐ Associated Location
                  </span>
                )}
                {selectedPin.stopType === "transport_waypoint" && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "var(--accent, #ff6600)",
                      backgroundColor: "rgba(255, 102, 0, 0.15)",
                      border: "1px solid rgba(255, 102, 0, 0.35)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    📍 Transit Waypoint
                  </span>
                )}
                {selectedPin.dayNumber && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      color: "var(--accent, #ff6600)",
                      backgroundColor: "rgba(255, 102, 0, 0.1)",
                      border: "1px solid rgba(255, 102, 0, 0.25)",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    Day {selectedPin.dayNumber}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginTop: "2px" }}>
                {[selectedPin.city, selectedPin.state, selectedPin.country].filter(Boolean).join(", ")}
                {selectedPin.latitude && selectedPin.longitude && (
                  <span style={{ marginLeft: "8px", fontFamily: "var(--font-mono, monospace)", fontSize: "11px" }}>
                    ({selectedPin.latitude.toFixed(4)}, {selectedPin.longitude.toFixed(4)})
                  </span>
                )}
              </div>
            </div>
          </div>

          {selectedPin.slug ? (
            <Link
              href={`/locations/${selectedPin.slug}`}
              className="trip-ghost-btn"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              <span>View Location Hub</span>
              <ExternalLink size={13} />
            </Link>
          ) : (
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted, #777)",
                backgroundColor: "rgba(255, 255, 255, 0.05)",
                padding: "4px 8px",
                borderRadius: "4px",
              }}
            >
              Itinerary Stop
            </span>
          )}
        </div>
      )}

      {/* Ordered Route List */}
      {routeStops.length > 0 && (
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Navigation size={15} style={{ color: "var(--accent, #ff6600)" }} />
            <span>Itinerary Route Order ({routeStops.length} stops)</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
            {routeStops.map((loc) => {
              const isSelected = selectedPin?.id === loc.id;
              const isAssoc = !!loc.isAssociatedLocation;
              return (
                <div
                  key={loc.id}
                  onClick={() => setSelectedPin(loc)}
                  style={{
                    backgroundColor: "var(--bg-card, #1c1c1c)",
                    border: `1px solid ${
                      isSelected
                        ? isAssoc
                          ? "#f59e0b"
                          : "var(--accent, #ff6600)"
                        : isAssoc
                        ? "rgba(245, 158, 11, 0.3)"
                        : "var(--border-color, #333)"
                    }`,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      backgroundColor: isSelected
                        ? isAssoc
                          ? "#f59e0b"
                          : "var(--accent, #ff6600)"
                        : isAssoc
                        ? "rgba(245, 158, 11, 0.25)"
                        : "#2c2c2c",
                      color: isAssoc ? "#fef3c7" : "#fff",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {loc.order}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "4px" }}>
                      {isAssoc && <span style={{ color: "#f59e0b", fontSize: "11px" }}>★</span>}
                      <span>{loc.name}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #777)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {loc.dayNumber ? `Day ${loc.dayNumber} • ` : ""}
                      {[loc.city, loc.country].filter(Boolean).join(", ") || "Location"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Associated Locations Section */}
      {associatedLocations.length > 0 && (
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#f59e0b" }}>⭐</span>
            <span>Associated Trip Locations ({associatedLocations.length})</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "10px" }}>
            {associatedLocations.map((loc) => {
              const isSelected = selectedPin?.id === loc.id;
              return (
                <div
                  key={`assoc-${loc.id}`}
                  onClick={() => setSelectedPin(loc)}
                  style={{
                    backgroundColor: "var(--bg-card, #1c1c1c)",
                    border: `1px solid ${isSelected ? "#f59e0b" : "rgba(245, 158, 11, 0.25)"}`,
                    borderRadius: "8px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    transition: "border-color 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      backgroundColor: isSelected ? "#f59e0b" : "rgba(245, 158, 11, 0.2)",
                      color: isSelected ? "#000" : "#f59e0b",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    ★
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {loc.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #777)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {[loc.city, loc.country].filter(Boolean).join(", ") || "Associated destination"}
                    </div>
                  </div>
                  {loc.slug && (
                    <Link
                      href={`/locations/${loc.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--text-muted, #777)", padding: "2px" }}
                      title="Open location hub"
                    >
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locations without coordinates notice */}
      {missingCoords.length > 0 && (
        <div
          style={{
            backgroundColor: "rgba(255, 102, 0, 0.06)",
            border: "1px dashed rgba(255, 102, 0, 0.25)",
            borderRadius: "10px",
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: 600, color: "var(--accent, #ff6600)", marginBottom: "6px" }}>
            <AlertCircle size={15} />
            <span>Locations omitted from map route (missing coordinates):</span>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "var(--text-secondary, #999)" }}>
            These locations are referenced in the trip or itinerary, but do not have latitude/longitude recorded.
          </p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {missingCoords.map((m) => (
              <Link
                key={m.id}
                href={`/locations/${m.slug}`}
                style={{
                  fontSize: "12px",
                  color: "var(--text-primary, #ddd)",
                  backgroundColor: "var(--bg-card, #202020)",
                  border: "1px solid var(--border-color, #333)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span>{m.name}</span>
                <span style={{ fontSize: "10px", color: "var(--text-muted, #777)" }}>→ Add coords</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
