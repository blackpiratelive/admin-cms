"use client";

import { useState, useEffect, useCallback } from "react";
import { TripRecord, TripDayRecord } from "@/db/schema";
import type { LocationPickerOption } from "@/features/pickers/types";
import {
  getTripDaysAction,
  generateTripDaysFromDatesAction,
  addTripDayAction,
  deleteTripDayAction,
} from "@/features/trips/day-actions";
import {
  parseTripDay,
  computeTripCostSummary,
  formatCostTotals,
} from "@/features/trips/day-helpers";
import { getLocationPickerData } from "@/features/pickers/actions";
import { TripDayEditorModal } from "@/features/trips/components/TripDayEditorModal";
import { notify } from "@/lib/notifications";
import {
  CalendarDays, Plus, Sparkles, MapPin, Edit2, Trash2, Bed, Utensils,
  Navigation, Camera, CloudSun,
} from "lucide-react";

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  borderRadius: "8px",
  padding: "16px",
};

export function TripItineraryTab({ trip }: { trip: TripRecord }) {
  const [days, setDays] = useState<TripDayRecord[]>([]);
  const [locations, setLocations] = useState<LocationPickerOption[]>([]);
  const [locationRecentIds, setLocationRecentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingDay, setEditingDay] = useState<TripDayRecord | null>(null);

  const load = useCallback(async () => {
    const [d, locData] = await Promise.all([getTripDaysAction(trip.id), getLocationPickerData()]);
    setDays(d);
    setLocations(locData.options);
    setLocationRecentIds(locData.recentIds);
    setLoading(false);
  }, [trip.id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = computeTripCostSummary(days);
  const hasDates = Boolean(trip.startDate && trip.endDate);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const next = await generateTripDaysFromDatesAction(trip.id);
      setDays(next);
    } finally {
      setBusy(false);
    }
  };

  const handleAddDay = async () => {
    setBusy(true);
    try {
      await addTripDayAction(trip.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (day: TripDayRecord) => {
    if (!confirm(`Delete Day ${day.dayNumber}${day.date ? ` (${day.date})` : ""}?`)) return;
    setDays((rows) => rows.filter((r) => r.id !== day.id));
    notify.bg({
      title: "Delete Day",
      loadingMessage: "Removing day...",
      successMessage: "Day removed",
      errorMessage: (err) => `Failed to delete day: ${err?.message || String(err)}`,
      task: () => deleteTripDayAction(day.id),
      onSuccess: () => load(),
    });
  };

  if (loading) {
    return <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>Loading itinerary...</div>;
  }

  const tripTotal = formatCostTotals(summary.total);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header: spend summary + actions */}
      <div style={{ ...cardStyle, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 700 }}>
            <CalendarDays size={16} style={{ color: "var(--accent)" }} /> {summary.dayCount} day{summary.dayCount === 1 ? "" : "s"}
          </span>
          {tripTotal && (
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Total spend: <strong style={{ color: "var(--text-primary)" }}>{tripTotal}</strong>
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {hasDates && (
            <button className="btn btn-secondary" onClick={handleGenerate} disabled={busy}>
              <Sparkles size={14} /> <span>Auto-generate days</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={handleAddDay} disabled={busy}>
            <Plus size={14} /> <span>Add day</span>
          </button>
        </div>
      </div>

      {days.length === 0 ? (
        <div style={{ ...cardStyle, padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
          No days recorded yet.{" "}
          {hasDates
            ? "Use “Auto-generate days” to create one entry per date, or add a day manually."
            : "Add a day to start your travel journal, or set trip dates to auto-generate them."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              costLabel={formatCostTotals(summary.perDay[day.id] || {})}
              onEdit={() => setEditingDay(day)}
              onDelete={() => handleDelete(day)}
            />
          ))}
        </div>
      )}

      <TripDayEditorModal
        isOpen={editingDay !== null}
        day={editingDay}
        locations={locations}
        locationRecentIds={locationRecentIds}
        onClose={() => setEditingDay(null)}
        onSaved={load}
      />
    </div>
  );
}

function DayCard({
  day, costLabel, onEdit, onDelete,
}: {
  day: TripDayRecord;
  costLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const parsed = parseTripDay(day);
  const place = day.primaryLocationName || "";
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase" }}>Day {day.dayNumber}</span>
            {day.date && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{day.date}</span>}
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "2px" }}>{day.title || "Untitled day"}</div>
          {place && (
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
              <MapPin size={12} style={{ color: "var(--text-muted)" }} /> {place}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {costLabel && <span style={{ fontSize: "13px", fontWeight: 700 }}>{costLabel}</span>}
          <button onClick={onEdit} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><Edit2 size={15} /></button>
          <button onClick={onDelete} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 size={15} /></button>
        </div>
      </div>

      {(parsed.transport.length > 0 || parsed.meals.length > 0 || parsed.activities.length > 0 ||
        parsed.accommodation.name || day.weather || day.mood || parsed.photos.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
          {parsed.transport.map((leg) => (
            <div key={leg.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Navigation size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span>{leg.mode}{(leg.fromName || leg.toName) ? `: ${leg.fromName || "?"} → ${leg.toName || "?"}` : ""}{typeof leg.cost === "number" ? ` · ${leg.currency || ""}${leg.cost}` : ""}</span>
            </div>
          ))}
          {parsed.meals.map((meal) => (
            <div key={meal.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Utensils size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span>{meal.type}{meal.place ? ` @ ${meal.place}` : ""}{meal.rating ? ` · ${"★".repeat(meal.rating)}` : ""}{typeof meal.cost === "number" ? ` · ${meal.currency || ""}${meal.cost}` : ""}</span>
            </div>
          ))}
          {parsed.activities.map((act) => (
            <div key={act.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span>{act.title || "Activity"}{act.time ? ` · ${act.time}` : ""}{typeof act.cost === "number" ? ` · ${act.currency || ""}${act.cost}` : ""}</span>
            </div>
          ))}
          {parsed.accommodation.name && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Bed size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span>{parsed.accommodation.name}{typeof parsed.accommodation.cost === "number" ? ` · ${parsed.accommodation.currency || ""}${parsed.accommodation.cost}` : ""}</span>
            </div>
          )}
          {(day.weather || day.mood) && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CloudSun size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span>{day.weather || ""}{day.weather && day.mood ? " · " : ""}{day.mood ? "★".repeat(day.mood) : ""}</span>
            </div>
          )}
          {parsed.photos.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <Camera size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {parsed.photos.slice(0, 6).map((p) => (
                  <img key={p.id} src={p.url} alt={p.caption || ""} style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "4px", border: "1px solid var(--border-color)" }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
