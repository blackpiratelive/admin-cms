"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { formatCalendarDate } from "@/features/trips/trip-helpers";
import { getLocationPickerData, getTripLocationIds } from "@/features/pickers/actions";
import { TripDayEditorModal } from "@/features/trips/components/TripDayEditorModal";
import { notify } from "@/lib/notifications";
import {
  Plus,
  Sparkles,
  MapPin,
  Edit2,
  Trash2,
  Bed,
  Utensils,
  Navigation,
  Camera,
  CloudSun,
  Smile,
  DollarSign,
  FileText,
} from "lucide-react";

export function TripItineraryTab({ trip }: { trip: TripRecord }) {
  const [days, setDays] = useState<TripDayRecord[]>([]);
  const [locations, setLocations] = useState<LocationPickerOption[]>([]);
  const [locationRecentIds, setLocationRecentIds] = useState<string[]>([]);
  const [tripLocationIds, setTripLocationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingDay, setEditingDay] = useState<TripDayRecord | null>(null);

  const load = useCallback(async () => {
    const [d, locData, tripLocIds] = await Promise.all([
      getTripDaysAction(trip.id),
      getLocationPickerData(),
      getTripLocationIds(trip.id),
    ]);
    setDays(d);
    setLocations(locData.options);
    setLocationRecentIds(locData.recentIds);
    setTripLocationIds(tripLocIds);
    setLoading(false);
  }, [trip.id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = computeTripCostSummary(days);
  const hasDates = Boolean(trip.startDate && trip.endDate);
  const locationsMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // Count documented days
  const documentedDaysCount = useMemo(() => {
    return days.filter((d) => {
      if (d.title || d.primaryLocationId || d.primaryLocationName || d.weather || d.mood || d.notesMarkdown) {
        return true;
      }
      try {
        const parsed = parseTripDay(d);
        return (
          parsed.transport.length > 0 ||
          parsed.meals.length > 0 ||
          parsed.activities.length > 0 ||
          Boolean(parsed.accommodation?.name || parsed.accommodation?.locationId) ||
          parsed.photos.length > 0
        );
      } catch {
        return false;
      }
    }).length;
  }, [days]);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const next = await generateTripDaysFromDatesAction(trip.id);
      setDays(next);
      await load();
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
    return (
      <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #888)" }}>
        Loading itinerary...
      </div>
    );
  }

  const tripTotal = formatCostTotals(summary.total);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Stat Boxes & Actions Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
        }}
      >
        <div
          style={{
            backgroundColor: "var(--bg-card, #1c1c1c)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "10px",
            padding: "12px 14px",
          }}
        >
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted, #888)", fontWeight: 700 }}>
            Total Days
          </span>
          <strong style={{ display: "block", fontSize: "18px", color: "var(--text-primary, #fff)", marginTop: "4px" }}>
            {summary.dayCount}
          </strong>
        </div>

        <div
          style={{
            backgroundColor: "var(--bg-card, #1c1c1c)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "10px",
            padding: "12px 14px",
          }}
        >
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted, #888)", fontWeight: 700 }}>
            Documented
          </span>
          <strong style={{ display: "block", fontSize: "18px", color: "var(--text-primary, #fff)", marginTop: "4px" }}>
            {documentedDaysCount} / {summary.dayCount}
          </strong>
        </div>

        <div
          style={{
            backgroundColor: "var(--bg-card, #1c1c1c)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "10px",
            padding: "12px 14px",
          }}
        >
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted, #888)", fontWeight: 700 }}>
            Total Spend
          </span>
          <strong style={{ display: "block", fontSize: "18px", color: "var(--text-primary, #fff)", marginTop: "4px" }}>
            {tripTotal || "—"}
          </strong>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "8px",
            gridColumn: "auto",
          }}
        >
          {hasDates && (
            <button
              type="button"
              className="trip-ghost-btn"
              onClick={handleGenerate}
              disabled={busy}
              style={{ fontSize: "13px" }}
            >
              <Sparkles size={14} />
              <span>Auto-generate</span>
            </button>
          )}

          <button
            type="button"
            className="trip-primary-btn"
            onClick={handleAddDay}
            disabled={busy}
            style={{ fontSize: "13px", padding: "9px 14px" }}
          >
            <Plus size={14} />
            <span>Add day</span>
          </button>
        </div>
      </div>

      {/* Days Timeline */}
      {days.length === 0 ? (
        <div className="trip-empty-box" style={{ padding: "40px 20px" }}>
          <strong className="trip-empty-title">No Itinerary Days Recorded</strong>
          <p className="trip-empty-desc">
            {hasDates
              ? "Use “Auto-generate” to automatically create an itinerary entry for each day of your trip, or add days manually."
              : "Add a day manually to start journaling your trip, or set start and end dates on the trip to auto-generate them."}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            {hasDates && (
              <button type="button" className="trip-primary-btn" onClick={handleGenerate} disabled={busy}>
                <Sparkles size={15} />
                <span>Auto-generate days</span>
              </button>
            )}
            <button type="button" className="trip-ghost-btn" onClick={handleAddDay} disabled={busy}>
              <Plus size={15} />
              <span>Add day manually</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", position: "relative" }}>
          {days.map((day) => (
            <DayTimelineCard
              key={day.id}
              day={day}
              locationsMap={locationsMap}
              costLabel={formatCostTotals(summary.perDay[day.id] || {})}
              onEdit={() => setEditingDay(day)}
              onDelete={() => handleDelete(day)}
            />
          ))}
        </div>
      )}

      {/* Day Editor Modal */}
      <TripDayEditorModal
        isOpen={editingDay !== null}
        day={editingDay}
        locations={locations}
        tripLocationIds={tripLocationIds}
        locationRecentIds={locationRecentIds}
        onClose={() => setEditingDay(null)}
        onSaved={load}
      />
    </div>
  );
}

function DayTimelineCard({
  day,
  locationsMap,
  costLabel,
  onEdit,
  onDelete,
}: {
  day: TripDayRecord;
  locationsMap: Map<string, LocationPickerOption>;
  costLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const parsed = parseTripDay(day);

  const resolveLocName = (locId?: string | null, fallback?: string | null): string => {
    if (locId && locationsMap.has(locId)) return locationsMap.get(locId)!.name;
    return fallback || "";
  };

  const place = resolveLocName(day.primaryLocationId, day.primaryLocationName);

  const hasDetails = Boolean(
    day.title ||
    place ||
    parsed.transport.length > 0 ||
    parsed.meals.length > 0 ||
    parsed.activities.length > 0 ||
    parsed.accommodation.name ||
    parsed.accommodation.locationId ||
    day.weather ||
    day.mood ||
    day.notesMarkdown ||
    parsed.photos.length > 0
  );

  const formattedDate = day.date ? formatCalendarDate(day.date) : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px minmax(0, 1fr)",
        gap: "16px",
      }}
    >
      {/* Left Day Identifier & Date */}
      <div style={{ textAlign: "right", paddingTop: "4px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.06em",
            color: "var(--accent, #ff6600)",
            textTransform: "uppercase",
          }}
        >
          DAY {day.dayNumber < 10 ? `0${day.dayNumber}` : day.dayNumber}
        </div>
        {formattedDate && (
          <div style={{ fontSize: "11px", color: "var(--text-muted, #888)", marginTop: "2px" }}>
            {formattedDate}
          </div>
        )}
      </div>

      {/* Right Card Content with Vertical Connector Line */}
      <div
        style={{
          borderLeft: "2px solid #3c3c3c",
          paddingLeft: "16px",
          paddingBottom: "8px",
          position: "relative",
        }}
      >
        {/* Timeline node circle */}
        <div
          style={{
            position: "absolute",
            left: "-5px",
            top: "8px",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: hasDetails ? "var(--accent, #ff6600)" : "#555",
            boxShadow: hasDetails ? "0 0 0 3px rgba(255,102,0,0.15)" : "none",
          }}
        />

        <div
          style={{
            backgroundColor: "var(--bg-card, #1c1c1c)",
            border: "1px solid var(--border-color, #333)",
            borderRadius: "10px",
            padding: "16px",
            transition: "border-color 0.15s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <div>
              <h4 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 750, color: "var(--text-primary, #fff)" }}>
                {day.title || (hasDetails ? "Day Itinerary" : "No itinerary details yet")}
              </h4>

              {place && (
                <div style={{ fontSize: "13px", color: "var(--text-secondary, #aaa)", display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                  <MapPin size={13} style={{ color: "var(--accent, #ff6600)" }} />
                  <span style={{ fontWeight: 600 }}>{place}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {costLabel && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    backgroundColor: "rgba(53, 168, 83, 0.12)",
                    color: "#35a853",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  {costLabel}
                </span>
              )}

              <button
                type="button"
                onClick={onEdit}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #888)",
                  cursor: "pointer",
                  padding: "4px",
                }}
                title="Edit day"
                aria-label={`Edit Day ${day.dayNumber}`}
              >
                <Edit2 size={15} />
              </button>

              <button
                type="button"
                onClick={onDelete}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  padding: "4px",
                }}
                title="Delete day"
                aria-label={`Delete Day ${day.dayNumber}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {!hasDetails ? (
            <div style={{ marginTop: "10px" }}>
              <button
                type="button"
                className="trip-ghost-btn"
                onClick={onEdit}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                <Plus size={13} />
                <span>Add details</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px", fontSize: "13px", color: "var(--text-secondary, #aaa)" }}>
              {/* Transport legs */}
              {parsed.transport.map((leg) => {
                const fromName = resolveLocName(leg.fromLocationId, leg.fromName);
                const toName = resolveLocName(leg.toLocationId, leg.toName);
                return (
                  <div key={leg.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Navigation size={13} style={{ color: "var(--accent, #ff6600)", flexShrink: 0 }} />
                    <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--text-primary, #ddd)" }}>
                      {leg.mode}
                    </span>
                    {(fromName || toName) && (
                      <span>: {fromName || "?"} → {toName || "?"}</span>
                    )}
                    {typeof leg.cost === "number" && (
                      <span style={{ color: "var(--text-muted, #777)" }}>· {leg.currency || ""}{leg.cost}</span>
                    )}
                  </div>
                );
              })}

              {/* Meals */}
              {parsed.meals.map((meal) => {
                const mealPlace = resolveLocName(meal.placeLocationId, meal.place);
                return (
                  <div key={meal.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Utensils size={13} style={{ color: "#f59e0b", flexShrink: 0 }} />
                    <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--text-primary, #ddd)" }}>
                      {meal.type}
                    </span>
                    {mealPlace && <span>@ {mealPlace}</span>}
                    {meal.dishes && <span style={{ color: "var(--text-muted, #888)" }}>({meal.dishes})</span>}
                    {meal.rating && <span style={{ color: "#f59e0b" }}>· {"★".repeat(meal.rating)}</span>}
                    {typeof meal.cost === "number" && (
                      <span style={{ color: "var(--text-muted, #777)" }}>· {meal.currency || ""}{meal.cost}</span>
                    )}
                  </div>
                );
              })}

              {/* Activities */}
              {parsed.activities.map((act) => {
                const actLocation = resolveLocName(act.locationId, act.locationName);
                return (
                  <div key={act.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MapPin size={13} style={{ color: "#3b82f6", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: "var(--text-primary, #ddd)" }}>
                      {act.title || "Activity"}
                    </span>
                    {actLocation && <span>({actLocation})</span>}
                    {act.time && <span style={{ color: "var(--text-muted, #888)" }}>· {act.time}</span>}
                    {typeof act.cost === "number" && (
                      <span style={{ color: "var(--text-muted, #777)" }}>· {act.currency || ""}{act.cost}</span>
                    )}
                  </div>
                );
              })}

              {/* Accommodation */}
              {(parsed.accommodation.name || parsed.accommodation.locationId) && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Bed size={13} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: "var(--text-primary, #ddd)" }}>
                    {resolveLocName(parsed.accommodation.locationId, parsed.accommodation.name || parsed.accommodation.locationName)}
                  </span>
                  {typeof parsed.accommodation.cost === "number" && (
                    <span style={{ color: "var(--text-muted, #777)" }}>· {parsed.accommodation.currency || ""}{parsed.accommodation.cost}</span>
                  )}
                </div>
              )}

              {/* Weather & Mood */}
              {(day.weather || day.mood) && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {day.weather && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CloudSun size={13} style={{ color: "var(--text-muted, #888)" }} />
                      <span>{day.weather}</span>
                    </span>
                  )}
                  {day.mood && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#f59e0b" }}>
                      <Smile size={13} />
                      <span>{"★".repeat(day.mood)}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Notes preview */}
              {day.notesMarkdown && (
                <div style={{ fontSize: "12px", color: "var(--text-secondary, #999)", display: "flex", alignItems: "flex-start", gap: "5px", marginTop: "2px" }}>
                  <FileText size={13} style={{ color: "var(--text-muted, #777)", marginTop: "2px", flexShrink: 0 }} />
                  <span style={{ fontStyle: "italic", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {day.notesMarkdown}
                  </span>
                </div>
              )}

              {/* Photos preview */}
              {parsed.photos.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <Camera size={13} style={{ color: "var(--text-muted, #888)", flexShrink: 0 }} />
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {parsed.photos.slice(0, 8).map((p) => (
                      <img
                        key={p.id}
                        src={p.url}
                        alt={p.caption || "Trip day photo"}
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          border: "1px solid var(--border-color, #333)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
