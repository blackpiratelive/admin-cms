"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TripLocationCoordinate } from "@/features/trips/types";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapboxTripMapProps {
  locations: TripLocationCoordinate[];
  token: string;
  selectedPin: TripLocationCoordinate | null;
  onSelectPin: (pin: TripLocationCoordinate) => void;
  onError?: (err: Error) => void;
}

type MapStyleKey = "dark" | "satellite" | "outdoors";

const MAP_STYLES: Record<MapStyleKey, { label: string; url: string }> = {
  dark: { label: "Dark", url: "mapbox://styles/mapbox/dark-v11" },
  satellite: { label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
  outdoors: { label: "Outdoors", url: "mapbox://styles/mapbox/outdoors-v12" },
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Generates intermediate spherical coordinates forming a great-circle arc for flight legs */
function generateGreatCircleArc(
  start: [number, number],
  end: [number, number],
  numPoints = 35
): [number, number][] {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;

  const rlat1 = toRad(lat1);
  const rlon1 = toRad(lng1);
  const rlat2 = toRad(lat2);
  const rlon2 = toRad(lng2);

  const cosD =
    Math.sin(rlat1) * Math.sin(rlat2) +
    Math.cos(rlat1) * Math.cos(rlat2) * Math.cos(rlon2 - rlon1);
  const d = Math.acos(Math.min(1, Math.max(-1, cosD)));

  if (d < 0.0001) {
    return [start, end];
  }

  const sinD = Math.sin(d);
  const coords: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const a = Math.sin((1 - f) * d) / sinD;
    const b = Math.sin(f * d) / sinD;

    const x = a * Math.cos(rlat1) * Math.cos(rlon1) + b * Math.cos(rlat2) * Math.cos(rlon2);
    const y = a * Math.cos(rlat1) * Math.sin(rlon1) + b * Math.cos(rlat2) * Math.sin(rlon2);
    const z = a * Math.sin(rlat1) + b * Math.sin(rlat2);

    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));

    coords.push([lng, lat]);
  }

  return coords;
}

/**
 * Generates a smooth, gently-bowed curve (quadratic Bézier) between two points.
 * Used for legs we have no precise geometry for — train, boat, ferry, "other",
 * or untyped gaps between stops — so the route never falls back to a bare
 * straight line. The curve always bows to the same side of the travel direction
 * so a multi-stop itinerary reads as one continuous flowing path.
 */
function generateCurvedArc(
  start: [number, number],
  end: [number, number],
  numPoints = 24,
  bend = 0.18
): [number, number][] {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1e-6) return [start, end];

  // Perpendicular unit vector to offset the Bézier control point sideways
  const nx = -dy / dist;
  const ny = dx / dist;
  const offset = dist * bend;
  const cx = (lng1 + lng2) / 2 + nx * offset;
  const cy = (lat1 + lat2) / 2 + ny * offset;

  const coords: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const mt = 1 - t;
    const x = mt * mt * lng1 + 2 * mt * t * cx + t * t * lng2;
    const y = mt * mt * lat1 + 2 * mt * t * cy + t * t * lat2;
    coords.push([x, y]);
  }
  return coords;
}

const directionsCache = new Map<string, [number, number][]>();

async function fetchDirectionsRoute(
  profile: "driving" | "walking" | "cycling",
  coords: [number, number][],
  token: string
): Promise<[number, number][] | null> {
  if (coords.length < 2) return null;
  const batch = coords.slice(0, 25);
  const coordString = batch.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
  const cacheKey = `${profile}:${coordString}`;

  if (directionsCache.has(cacheKey)) {
    return directionsCache.get(cacheKey)!;
  }

  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordString}?geometries=geojson&overview=full&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.routes && data.routes.length > 0 && data.routes[0].geometry?.coordinates) {
      const line: [number, number][] = data.routes[0].geometry.coordinates;
      directionsCache.set(cacheKey, line);
      return line;
    }
  } catch (err) {
    console.warn("Mapbox directions fetch error:", err);
  }
  return null;
}

export function MapboxTripMap({
  locations,
  token,
  selectedPin,
  onSelectPin,
  onError,
}: MapboxTripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [activeStyle, setActiveStyle] = useState<MapStyleKey>("dark");
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize Mapbox Map
  useEffect(() => {
    if (!containerRef.current || !token) return;

    let mapInstance: any = null;
    let isCancelled = false;

    (async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        if (isCancelled || !containerRef.current) return;

        mapboxgl.accessToken = token;

        // Check WebGL support
        if (!mapboxgl.supported()) {
          onError?.(new Error("WebGL is not supported in this browser."));
          return;
        }

        const validLocations = locations.filter(
          (l) => l.latitude !== null && l.longitude !== null
        );

        const center: [number, number] =
          validLocations.length > 0
            ? [validLocations[0].longitude!, validLocations[0].latitude!]
            : [0, 20];

        mapInstance = new mapboxgl.Map({
          container: containerRef.current,
          style: MAP_STYLES.dark.url,
          center,
          zoom: validLocations.length > 1 ? 5 : 9,
          attributionControl: false,
        });

        // Add navigation controls (zoom, pitch, compass)
        mapInstance.addControl(
          new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }),
          "bottom-right"
        );

        mapRef.current = mapInstance;

        mapInstance.on("load", () => {
          if (isCancelled) return;
          setMapLoaded(true);
          renderRouteAndMarkers(mapInstance, mapboxgl);
        });

        mapInstance.on("error", (e: any) => {
          if (e?.error?.status === 401 || e?.error?.message?.includes("forbidden")) {
            onError?.(new Error("Invalid Mapbox token."));
          }
        });
      } catch (err: any) {
        console.error("Failed to initialize Mapbox:", err);
        onError?.(err);
      }
    })();

    return () => {
      isCancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapInstance) {
        mapInstance.remove();
        mapRef.current = null;
      }
    };
  }, [token]);

  // Re-render route and markers on style change or locations update
  const renderRouteAndMarkers = (map: any, mapboxgl: any) => {
    if (!map || !locations.length) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const validLocations = locations.filter(
      (l) => l.latitude !== null && l.longitude !== null
    );

    if (validLocations.length === 0) return;

    // 1. Add / update Route Line GeoJSON Layer
    // Connect chronological itinerary route stops (excluding standalone associated pins)
    const itineraryStops = validLocations.filter((l) => l.stopType !== "associated");
    const linePoints = itineraryStops.length >= 2 ? itineraryStops : validLocations;

    // Generate initial synchronous geometry
    const segmentList: [number, number][][] = [];
    for (let i = 0; i < linePoints.length - 1; i++) {
      const p1 = linePoints[i];
      const p2 = linePoints[i + 1];
      const startCoord: [number, number] = [p1.longitude!, p1.latitude!];
      const endCoord: [number, number] = [p2.longitude!, p2.latitude!];
      const mode = p2.transportMode || p1.transportMode;

      if (mode === "flight") {
        // Geographically accurate airline great-circle arc
        segmentList.push(generateGreatCircleArc(startCoord, endCoord, 35));
      } else {
        // Road modes start as a gentle curve and are upgraded to real road
        // geometry asynchronously below; everything else (train, boat, other,
        // or untyped gaps) keeps the smooth curve so no straight line remains.
        segmentList.push(generateCurvedArc(startCoord, endCoord));
      }
    }

    const mergeSegments = (segs: [number, number][][]): [number, number][] => {
      const merged: [number, number][] = [];
      segs.forEach((seg, sIdx) => {
        if (sIdx === 0) {
          merged.push(...seg);
        } else {
          merged.push(...seg.slice(1));
        }
      });
      return merged;
    };

    const initialLineCoords = mergeSegments(segmentList);
    const routeGeoJson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: initialLineCoords,
      },
    };

    if (map.getSource("trip-route-source")) {
      map.getSource("trip-route-source").setData(routeGeoJson);
    } else {
      map.addSource("trip-route-source", {
        type: "geojson",
        data: routeGeoJson,
      });

      // Outer glow line
      map.addLayer({
        id: "trip-route-glow",
        type: "line",
        source: "trip-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff6600",
          "line-width": 6,
          "line-opacity": 0.35,
          "line-blur": 3,
        },
      });

      // Inner dashed line
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ff8e4d",
          "line-width": 3,
          "line-dasharray": [2, 1.5],
        },
      });
    }

    // Asynchronously enhance road segments via Mapbox Directions API
    if (token && segmentList.length > 0) {
      (async () => {
        let changed = false;
        const enhancedSegments = [...segmentList];

        for (let i = 0; i < linePoints.length - 1; i++) {
          const p1 = linePoints[i];
          const p2 = linePoints[i + 1];
          const mode = p2.transportMode || p1.transportMode;

          if (
            mode === "walk" ||
            mode === "bike" ||
            mode === "car" ||
            mode === "taxi" ||
            mode === "bus"
          ) {
            const profile: "driving" | "walking" | "cycling" =
              mode === "walk" ? "walking" : mode === "bike" ? "cycling" : "driving";
            const startCoord: [number, number] = [p1.longitude!, p1.latitude!];
            const endCoord: [number, number] = [p2.longitude!, p2.latitude!];
            const roadCurve = await fetchDirectionsRoute(profile, [startCoord, endCoord], token);
            if (roadCurve && roadCurve.length > 0) {
              enhancedSegments[i] = roadCurve;
              changed = true;
            }
          }
        }

        if (changed && map && map.getSource("trip-route-source")) {
          map.getSource("trip-route-source").setData({
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: mergeSegments(enhancedSegments),
            },
          });
        }
      })();
    }

    // 2. Add Numbered Markers and Transit Waypoint Dots with Popups
    const bounds = new mapboxgl.LngLatBounds();

    validLocations.forEach((loc) => {
      const lngLat: [number, number] = [loc.longitude!, loc.latitude!];
      bounds.extend(lngLat);

      const isAssoc = !!loc.isAssociatedLocation;
      const isWaypoint = loc.stopType === "transport_waypoint";
      const pinContent = isWaypoint ? "•" : isAssoc && loc.stopType === "associated" ? "★" : String(loc.order);

      // Create custom DOM element for pin marker
      const el = document.createElement("div");
      el.className = "trip-mapbox-marker";
      el.innerHTML = `
        <div class="trip-mapbox-pin ${selectedPin?.id === loc.id ? "selected" : ""} ${isAssoc ? "associated" : ""} ${isWaypoint ? "waypoint" : ""}">
          <span>${pinContent}</span>
        </div>
        <div class="trip-mapbox-pin-label ${isAssoc ? "associated" : ""} ${isWaypoint ? "waypoint" : ""}">${loc.name}</div>
      `;

      // Popup
      const fullLoc = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
      let badgeHtml = "";
      if (isAssoc) {
        badgeHtml = `<div class="popup-associated-badge" style="display: inline-block; font-size: 10px; font-weight: 700; color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 6px; border-radius: 4px; margin-bottom: 6px;">⭐ Associated Trip Location</div>`;
      } else if (isWaypoint) {
        badgeHtml = `<div class="popup-waypoint-badge" style="display: inline-block; font-size: 10px; font-weight: 700; color: var(--accent, #ff6600); background: rgba(255, 102, 0, 0.15); border: 1px solid rgba(255, 102, 0, 0.35); padding: 2px 6px; border-radius: 4px; margin-bottom: 6px;">📍 Transit Waypoint</div>`;
      }

      const orderLabel = isWaypoint
        ? (loc.dayNumber ? `Day ${loc.dayNumber} · Via Intermediate Stop` : "Via Intermediate Stop")
        : loc.dayNumber
        ? `Day ${loc.dayNumber} Stop`
        : loc.stopType === "associated"
        ? "Associated Location"
        : `Stop ${loc.order}`;
      const linkHtml = loc.slug
        ? `<a href="/locations/${loc.slug}" class="popup-link">View Location Hub →</a>`
        : `<span class="popup-sub" style="display: block; margin-top: 6px; font-style: italic; font-size: 11px;">Itinerary Stop</span>`;

      const popupHtml = `
        <div class="trip-mapbox-popup">
          ${badgeHtml}
          <div class="popup-order">${orderLabel}</div>
          <div class="popup-title">${loc.name}</div>
          ${fullLoc ? `<div class="popup-sub">${fullLoc}</div>` : ""}
          ${linkHtml}
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: isWaypoint ? 14 : 24,
        closeButton: false,
        className: "trip-mapbox-popup-wrap",
      }).setHTML(popupHtml);

      el.addEventListener("click", () => {
        onSelectPin(loc);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 3. Fit bounds with padding
    if (validLocations.length > 1) {
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 60, left: 60, right: 60 },
        maxZoom: 13,
        duration: 1000,
      });
    } else {
      map.flyTo({
        center: [validLocations[0].longitude!, validLocations[0].latitude!],
        zoom: 10,
        duration: 1000,
      });
    }
  };

  // Re-render when locations list updates while map is loaded
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      renderRouteAndMarkers(mapRef.current, mapboxgl);
    })();
  }, [locations, mapLoaded]);

  // Switch style safely re-adding layers
  const handleStyleChange = async (styleKey: MapStyleKey) => {
    if (!mapRef.current || styleKey === activeStyle) return;
    setActiveStyle(styleKey);
    const map = mapRef.current;
    const mapboxgl = (await import("mapbox-gl")).default;

    map.setStyle(MAP_STYLES[styleKey].url);
    map.once("style.load", () => {
      renderRouteAndMarkers(map, mapboxgl);
    });
  };

  // Fly to selected pin when prop updates
  useEffect(() => {
    if (!mapRef.current || !selectedPin || selectedPin.latitude === null || selectedPin.longitude === null) {
      return;
    }
    const map = mapRef.current;
    map.flyTo({
      center: [selectedPin.longitude, selectedPin.latitude],
      zoom: Math.max(map.getZoom(), 8),
      duration: 800,
    });
  }, [selectedPin]);

  return (
    <div
      style={{
        position: "relative",
        height: "440px",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid var(--border-color, #383838)",
        backgroundColor: "#161616",
      }}
    >
      {/* Mapbox container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Style Switcher Controls */}
      <div
        className="trip-map-style-switcher"
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 10,
          display: "flex",
          gap: "4px",
          backgroundColor: "rgba(20, 20, 20, 0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "8px",
          padding: "3px",
        }}
        role="group"
        aria-label="Map style switcher"
      >
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleStyleChange(key)}
            style={{
              background: activeStyle === key ? "var(--accent, #ff6600)" : "transparent",
              color: activeStyle === key ? "#ffffff" : "var(--text-muted, #aaa)",
              border: 0,
              borderRadius: "6px",
              padding: "5px 10px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {MAP_STYLES[key].label}
          </button>
        ))}
      </div>

      {/* Mapbox Attribution Badge */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "12px",
          zIndex: 10,
          fontSize: "10px",
          color: "rgba(255, 255, 255, 0.5)",
          pointerEvents: "none",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          padding: "2px 6px",
          borderRadius: "4px",
        }}
      >
        Mapbox GL · {locations.length} stops
      </div>
    </div>
  );
}
