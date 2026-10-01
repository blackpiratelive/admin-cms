"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { LocationPickerOption } from "@/features/pickers/types";
import { EntityCombobox, ComboAction } from "@/components/EntityCombobox";
import { quickCreateLocationAction } from "@/features/locations/actions";
import { notify } from "@/lib/notifications";
import type { GeocodeResult } from "@/app/api/geocode/route";
import { Plus, MapPin } from "lucide-react";

export interface LocationPickerFieldProps {
  locations: LocationPickerOption[];
  /** Priority option IDs (e.g. current trip's locations) floated to top */
  priorityIds?: string[];
  recentIds?: string[];
  locationId?: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  tripId?: string;
  placeholder?: string;
  ariaLabel?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  onChange: (next: {
    locationId?: string;
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
  }) => void;
  onLocationCreated?: (loc: LocationPickerOption) => void;
}

export function LocationPickerField({
  locations,
  priorityIds,
  recentIds,
  locationId,
  name,
  latitude,
  longitude,
  tripId,
  placeholder = "Search or type a place…",
  ariaLabel = "Location",
  allowCustom = true,
  disabled = false,
  onChange,
  onLocationCreated,
}: LocationPickerFieldProps) {
  const [query, setQuery] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced Mapbox forward geocoding lookup
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGeocodeResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setGeocodeResults(Array.isArray(data.results) ? data.results : []);
        } else {
          setGeocodeResults([]);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setGeocodeResults([]);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleQuickCreate = (data: {
    name: string;
    city?: string;
    state?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    notify.bg({
      title: "Create Location",
      loadingMessage: `Creating location '${data.name}'...`,
      successMessage: `Location '${data.name}' created!`,
      errorMessage: (err) => `Failed to create location: ${err?.message || String(err)}`,
      task: async () => {
        const newLoc = await quickCreateLocationAction({ ...data, tripId });
        onLocationCreated?.(newLoc);
        onChange({
          locationId: newLoc.id,
          name: newLoc.name,
          latitude: newLoc.latitude ?? data.latitude ?? null,
          longitude: newLoc.longitude ?? data.longitude ?? null,
        });
      },
    });
  };

  const extraActions = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    const actions: ComboAction[] = [];
    const lowerQ = q.toLowerCase();

    // 1. Geocoded place suggestions (top 3)
    for (const geo of geocodeResults.slice(0, 3)) {
      // 1A. Select directly without creating permanent location entity
      const coordLabel =
        geo.latitude != null && geo.longitude != null
          ? ` [${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}]`
          : "";
      actions.push({
        id: `geo_select_${geo.id}`,
        label: `📍 ${geo.name}`,
        sublabel: `${geo.label !== geo.name ? geo.label + " • " : ""}${coordLabel}`.trim(),
        icon: <MapPin size={13} style={{ color: "var(--accent, #f97316)" }} />,
        onSelect: () =>
          onChange({
            locationId: undefined,
            name: geo.name,
            latitude: geo.latitude ?? null,
            longitude: geo.longitude ?? null,
          }),
      });

      // 1B. Optional: Save as permanent Location entity (if entity doesn't already exist)
      const alreadyExists = locations.some((l) => l.name.toLowerCase() === geo.name.toLowerCase());
      if (!alreadyExists) {
        actions.push({
          id: `geo_create_${geo.id}`,
          label: `+ Save “${geo.name}” as Location Entity`,
          sublabel: "Create permanent location entity with coordinates",
          icon: <Plus size={13} style={{ color: "var(--text-muted, #888)" }} />,
          onSelect: () =>
            handleQuickCreate({
              name: geo.name,
              city: geo.city,
              state: geo.state,
              country: geo.country,
              latitude: geo.latitude,
              longitude: geo.longitude,
            }),
        });
      }
    }

    // 2. Generic fallback to create location with typed name if no exact match exists
    const hasExactLoc = locations.some((l) => l.name.toLowerCase() === lowerQ);
    const hasExactGeo = geocodeResults.some((g) => g.name.toLowerCase() === lowerQ);
    if (!hasExactLoc && !hasExactGeo) {
      actions.push({
        id: `create_custom_${q}`,
        label: `+ Add “${q}” as Location`,
        sublabel: "Create new location entity",
        icon: <Plus size={13} style={{ color: "var(--accent, #f97316)" }} />,
        onSelect: () => handleQuickCreate({ name: q }),
      });
    }

    return actions;
  }, [query, geocodeResults, locations, tripId]);

  const hasCoords =
    latitude != null &&
    longitude != null &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <EntityCombobox
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        noneLabel="Custom / none"
        value={locationId || null}
        priorityIds={priorityIds}
        recentIds={recentIds}
        allowCustom={allowCustom}
        customValue={locationId ? "" : (name || "")}
        customPlaceholder={placeholder}
        disabled={disabled}
        onQueryChange={setQuery}
        extraActions={extraActions}
        onChange={(id) => {
          if (id) {
            const loc = locations.find((l) => l.id === id);
            onChange({
              locationId: id,
              name: loc?.name || undefined,
              latitude: loc?.latitude ?? null,
              longitude: loc?.longitude ?? null,
            });
          } else {
            onChange({
              locationId: undefined,
              name: undefined,
              latitude: null,
              longitude: null,
            });
          }
        }}
        onCustomChange={(text) => {
          if (!text || !text.trim()) return;
          onChange({
            locationId: undefined,
            name: text.trim(),
            latitude: null,
            longitude: null,
          });
        }}
        options={locations.map((l) => ({
          id: l.id,
          label: l.name,
          sublabel: [l.city, l.country].filter(Boolean).join(", ") || undefined,
          favorite: l.favorite,
        }))}
      />
      {hasCoords && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            fontSize: "10px",
            color: "var(--accent, #f97316)",
            marginTop: "2px",
            fontFamily: "var(--font-mono, monospace)",
          }}
          title={`Coordinates: ${latitude}, ${longitude}`}
        >
          <MapPin size={10} />
          <span>
            {latitude!.toFixed(4)}, {longitude!.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}
