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
    const lineCoordinates = validLocations.map((l) => [l.longitude!, l.latitude!]);

    const routeGeoJson = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: lineCoordinates,
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

    // 2. Add Numbered Markers with Popups
    const bounds = new mapboxgl.LngLatBounds();

    validLocations.forEach((loc) => {
      const lngLat: [number, number] = [loc.longitude!, loc.latitude!];
      bounds.extend(lngLat);

      // Create custom DOM element for pin marker
      const el = document.createElement("div");
      el.className = "trip-mapbox-marker";
      el.innerHTML = `
        <div class="trip-mapbox-pin ${selectedPin?.id === loc.id ? "selected" : ""}">
          <span>${loc.order}</span>
        </div>
        <div class="trip-mapbox-pin-label">${loc.name}</div>
      `;

      // Popup
      const fullLoc = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
      const popupHtml = `
        <div class="trip-mapbox-popup">
          <div class="popup-order">Stop ${loc.order}</div>
          <div class="popup-title">${loc.name}</div>
          ${fullLoc ? `<div class="popup-sub">${fullLoc}</div>` : ""}
          <a href="/locations/${loc.slug}" class="popup-link">View Location Hub →</a>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 24,
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
