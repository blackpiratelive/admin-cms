"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { LocationPickerOption } from "@/features/pickers/types";
import { EntityCombobox, ComboAction } from "@/components/EntityCombobox";
import { quickCreateLocationAction } from "@/features/locations/actions";
import { notify } from "@/lib/notifications";
import type { GeocodeResult } from "@/app/api/geocode/route";
import { Plus } from "lucide-react";

export interface LocationPickerFieldProps {
  locations: LocationPickerOption[];
  /** Priority option IDs (e.g. current trip's locations) floated to top */
  priorityIds?: string[];
  recentIds?: string[];
  locationId?: string;
  name?: string;
  tripId?: string;
  placeholder?: string;
  ariaLabel?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  onChange: (next: { locationId?: string; name?: string }) => void;
  onLocationCreated?: (loc: LocationPickerOption) => void;
}

export function LocationPickerField({
  locations,
  priorityIds,
  recentIds,
  locationId,
  name,
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
        onChange({ locationId: newLoc.id, name: newLoc.name });
      },
    });
  };

  const extraActions = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];

    const actions: ComboAction[] = [];
    const lowerQ = q.toLowerCase();

    // 1. Geocoded place suggestions
    for (const geo of geocodeResults) {
      actions.push({
        id: `geo_${geo.id}`,
        label: `+ Add “${geo.name}” as Location`,
        sublabel: geo.label !== geo.name ? geo.label : [geo.city, geo.country].filter(Boolean).join(", "),
        icon: <Plus size={13} style={{ color: "var(--accent, #f97316)" }} />,
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

  return (
    <EntityCombobox
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      noneLabel="Custom / none"
      value={locationId || null}
      priorityIds={priorityIds}
      recentIds={recentIds}
      allowCustom={allowCustom}
      customValue={name}
      customPlaceholder={placeholder}
      disabled={disabled}
      onQueryChange={setQuery}
      extraActions={extraActions}
      onChange={(id) => {
        if (id) {
          const loc = locations.find((l) => l.id === id);
          onChange({ locationId: id, name: loc?.name || undefined });
        } else {
          onChange({ locationId: undefined, name });
        }
      }}
      onCustomChange={(text) => onChange({ locationId: undefined, name: text })}
      options={locations.map((l) => ({
        id: l.id,
        label: l.name,
        sublabel: [l.city, l.country].filter(Boolean).join(", ") || undefined,
        favorite: l.favorite,
      }))}
    />
  );
}
