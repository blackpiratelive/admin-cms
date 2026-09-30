"use client";

import React, { useEffect, useState } from "react";
import { getJournalContextualData, getEntityPickersData } from "../actions";
import { getLocationPickerData, getTripPickerData } from "@/features/pickers/actions";
import type { LocationPickerData, TripPickerData } from "@/features/pickers/types";
import { EntityCombobox } from "@/components/EntityCombobox";
import { MapPin, Compass, Users, Folder, Film, Music, Image, MessageSquare, Plus, X } from "lucide-react";

interface PickersData {
  locations: Array<{ id: string; name: string; city: string | null; country: string | null }>;
  trips: Array<{ id: string; title: string; startDate: string | null }>;
  people: Array<{ id: string; displayName: string; avatarUrl: string | null }>;
  projects: Array<{ id: string; name: string; status: string }>;
}

interface ContextualData {
  photos: any[];
  movies: any[];
  scrobbles: any[];
  microblogs: any[];
}

interface JournalConnectionsPanelProps {
  entryDate: string; // YYYY-MM-DD
  locationId?: string | null;
  tripId?: string | null;
  onLocationChange?: (locId: string | null) => void;
  onTripChange?: (tripId: string | null) => void;
  selectedPeopleIds?: string[];
  onPeopleChange?: (personIds: string[]) => void;
  selectedProjectIds?: string[];
  onProjectChange?: (projectIds: string[]) => void;
}

export function JournalConnectionsPanel({
  entryDate,
  locationId,
  tripId,
  onLocationChange,
  onTripChange,
  selectedPeopleIds = [],
  onPeopleChange,
  selectedProjectIds = [],
  onProjectChange,
}: JournalConnectionsPanelProps) {
  const [pickers, setPickers] = useState<PickersData | null>(null);
  const [contextData, setContextData] = useState<ContextualData | null>(null);
  const [locationPicker, setLocationPicker] = useState<LocationPickerData>({ options: [], recentIds: [] });
  const [tripPicker, setTripPicker] = useState<TripPickerData>({ options: [], recentIds: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [pData, cData, locData, tripData] = await Promise.all([
          getEntityPickersData(),
          getJournalContextualData(entryDate),
          getLocationPickerData(),
          getTripPickerData(),
        ]);
        setPickers(pData);
        setContextData(cData);
        setLocationPicker(locData);
        setTripPicker(tripData);
      } catch (err) {
        console.error("Error loading contextual data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [entryDate]);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "16px",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "8px",
        color: "var(--text-primary)",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
        Context & Connections
      </div>

      {/* Location Picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
          <MapPin size={14} style={{ color: "var(--accent)" }} />
          <span>Location</span>
        </div>
        <EntityCombobox
          ariaLabel="Location"
          placeholder="Search locations…"
          noneLabel="No location linked"
          value={locationId || null}
          onChange={(id) => onLocationChange?.(id)}
          recentIds={locationPicker.recentIds}
          options={locationPicker.options.map((loc) => ({
            id: loc.id,
            label: loc.name,
            sublabel: [loc.city, loc.country].filter(Boolean).join(", ") || undefined,
            favorite: loc.favorite,
          }))}
        />
      </div>

      {/* Trip Picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
          <Compass size={14} style={{ color: "var(--accent)" }} />
          <span>Trip</span>
        </div>
        <EntityCombobox
          ariaLabel="Trip"
          placeholder="Search trips…"
          noneLabel="No trip linked"
          value={tripId || null}
          onChange={(id) => onTripChange?.(id)}
          recentIds={tripPicker.recentIds}
          options={tripPicker.options.map((tr) => ({
            id: tr.id,
            label: tr.title,
            sublabel: tr.startDate ? tr.startDate.slice(0, 10) : undefined,
            favorite: tr.favorite,
          }))}
        />
      </div>

      {/* People Picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
          <Users size={14} style={{ color: "var(--accent)" }} />
          <span>People Present</span>
        </div>
        <select
          onChange={(e) => {
            if (e.target.value && !selectedPeopleIds.includes(e.target.value)) {
              onPeopleChange?.([...selectedPeopleIds, e.target.value]);
            }
          }}
          value=""
          style={{
            width: "100%",
            padding: "8px 10px",
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontSize: "13px",
            outline: "none",
          }}
        >
          <option value="">+ Tag Person</option>
          {pickers?.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
          {selectedPeopleIds.map((pid) => {
            const person = pickers?.people.find((p) => p.id === pid);
            return (
              <span
                key={pid}
                style={{
                  fontSize: "11px",
                  padding: "3px 8px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(249, 115, 22, 0.15)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {person?.displayName || pid}
                <X
                  size={12}
                  style={{ cursor: "pointer" }}
                  onClick={() => onPeopleChange?.(selectedPeopleIds.filter((id) => id !== pid))}
                />
              </span>
            );
          })}
        </div>
      </div>

      {/* Daily Activity Stream Metadata */}
      <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
          On This Day ({entryDate})
        </div>

        {/* Movies Watched */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <Film size={13} />
            <span>Movies Watched ({contextData?.movies.length || 0})</span>
          </div>
          {contextData?.movies.map((m) => (
            <div key={m.traktId} style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "18px" }}>
              🎬 {m.title} ({m.year})
            </div>
          ))}
        </div>

        {/* Scrobbles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <Music size={13} />
            <span>Music Listen Count ({contextData?.scrobbles.length || 0})</span>
          </div>
          {contextData?.scrobbles.slice(0, 3).map((s) => (
            <div key={s.id} style={{ fontSize: "12px", color: "var(--text-muted)", paddingLeft: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              🎵 {s.artist} - {s.track}
            </div>
          ))}
        </div>

        {/* Photos Taken */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <Image size={13} />
            <span>Photos Captured ({contextData?.photos.length || 0})</span>
          </div>
          {contextData?.photos.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", paddingLeft: "18px" }}>
              {contextData.photos.slice(0, 3).map((ph) => (
                <img
                  key={ph.id}
                  src={ph.thumbnailUrl || ph.smallUrl}
                  alt={ph.title}
                  style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px" }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
