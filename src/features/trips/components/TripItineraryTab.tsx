"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  FileText,
} from "lucide-react";

/** Format a single amount with its (optional) currency prefix, e.g. "₹ 360". */
function formatMoney(cost?: number, currency?: string): string {
  if (typeof cost !== "number" || Number.isNaN(cost) || cost === 0) return "";
  const num = cost.toLocaleString();
  const cur = (currency || "").trim();
  return cur ? `${cur} ${num}` : num;
}

export function TripItineraryTab({ trip }: { trip: TripRecord }) {
  const [days, setDays] = useState<TripDayRecord[]>([]);
  const [locations, setLocations] = useState<LocationPickerOption[]>([]);
  const [locationRecentIds, setLocationRecentIds] = useState<string[]>([]);
  const [tripLocationIds, setTripLocationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingDay, setEditingDay] = useState<TripDayRecord | null>(null);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const isDayDocumented = useCallback((d: TripDayRecord): boolean => {
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
  }, []);

  const documentedDaysCount = useMemo(
    () => days.filter(isDayDocumented).length,
    [days, isDayDocumented]
  );
  const handleGenerate = async () => {
    setBusy(true);
    try {
      await generateTripDaysFromDatesAction(trip.id);
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

  const scrollToDay = (id: string) => {
    dayRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* Stats + Actions */}
      <div className="itin-top">
        <div className="itin-stats-grid">
          <div className="itin-stat">
            <span className="itin-stat-label">Total Days</span>
            <strong className="itin-stat-value">{summary.dayCount}</strong>
          </div>
          <div className="itin-stat">
            <span className="itin-stat-label">Documented</span>
            <strong className="itin-stat-value">{documentedDaysCount} / {summary.dayCount}</strong>
          </div>
          <div className="itin-stat">
            <span className="itin-stat-label">Total Spend</span>
            <strong className="itin-stat-value">{tripTotal || "—"}</strong>
          </div>
        </div>

        <div className="itin-actions">
          {hasDates && (
            <button type="button" className="trip-ghost-btn" onClick={handleGenerate} disabled={busy} style={{ fontSize: "13px" }}>
              <Sparkles size={14} />
              <span>Auto-generate</span>
            </button>
          )}
          <button type="button" className="trip-primary-btn" onClick={handleAddDay} disabled={busy} style={{ fontSize: "13px", padding: "9px 14px" }}>
            <Plus size={14} />
            <span>Add day</span>
          </button>
        </div>
      </div>

      {/* Jump-to-day navigation */}
      {days.length > 1 && (
        <div className="itin-daynav" role="navigation" aria-label="Jump to day">
          {days.map((d) => (
            <button
              key={d.id}
              type="button"
              className="itin-daynav-chip"
              onClick={() => scrollToDay(d.id)}
              title={d.date ? formatCalendarDate(d.date) : `Day ${d.dayNumber}`}
            >
              <span className={`itin-daynav-dot ${isDayDocumented(d) ? "on" : ""}`} />
              <span>Day {d.dayNumber < 10 ? `0${d.dayNumber}` : d.dayNumber}</span>
            </button>
          ))}
        </div>
      )}
      {/* Days Timeline */}
      {days.length === 0 ? (
        <div className="trip-empty-box" style={{ padding: "40px 20px" }}>
          <strong className="trip-empty-title">No Itinerary Days Recorded</strong>
          <p className="trip-empty-desc">
            {hasDates
              ? "Use “Auto-generate” to automatically create an itinerary entry for each day of your trip, or add days manually."
              : "Add a day manually to start journaling your trip, or set start and end dates on the trip to auto-generate them."}
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {days.map((day) => (
            <DayTimelineCard
              key={day.id}
              day={day}
              documented={isDayDocumented(day)}
              locationsMap={locationsMap}
              costLabel={formatCostTotals(summary.perDay[day.id] || {})}
              onEdit={() => setEditingDay(day)}
              onDelete={() => handleDelete(day)}
              cardRef={(el) => {
                dayRefs.current[day.id] = el;
              }}
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
  documented,
  locationsMap,
  costLabel,
  onEdit,
  onDelete,
  cardRef,
}: {
  day: TripDayRecord;
  documented: boolean;
  locationsMap: Map<string, LocationPickerOption>;
  costLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const parsed = parseTripDay(day);

  const resolveLocName = (locId?: string | null, fallback?: string | null): string => {
    if (locId && locationsMap.has(locId)) return locationsMap.get(locId)!.name;
    return fallback || "";
  };

  const place = resolveLocName(day.primaryLocationId, day.primaryLocationName);
  const formattedDate = day.date ? formatCalendarDate(day.date) : null;

  const hasAccommodation = Boolean(parsed.accommodation.name || parsed.accommodation.locationId);
  const accommodationName = resolveLocName(
    parsed.accommodation.locationId,
    parsed.accommodation.name || parsed.accommodation.locationName
  );
  const accommodationCost = formatMoney(parsed.accommodation.cost, parsed.accommodation.currency);

  const hasDetails = Boolean(
    day.title ||
    place ||
    parsed.transport.length > 0 ||
    parsed.meals.length > 0 ||
    parsed.activities.length > 0 ||
    hasAccommodation ||
    day.weather ||
    day.mood ||
    day.notesMarkdown ||
    parsed.photos.length > 0
  );

  // Glance summary chips (quick per-day counts)
  const glance: { icon: React.ReactNode; label: string }[] = [];
  if (parsed.transport.length)
    glance.push({ icon: <Navigation size={11} />, label: `${parsed.transport.length} transport` });
  if (parsed.meals.length)
    glance.push({ icon: <Utensils size={11} />, label: `${parsed.meals.length} meal${parsed.meals.length > 1 ? "s" : ""}` });
  if (parsed.activities.length)
    glance.push({ icon: <MapPin size={11} />, label: `${parsed.activities.length} ${parsed.activities.length > 1 ? "activities" : "activity"}` });
  if (hasAccommodation) glance.push({ icon: <Bed size={11} />, label: "stay" });
  if (parsed.photos.length)
    glance.push({ icon: <Camera size={11} />, label: `${parsed.photos.length} photo${parsed.photos.length > 1 ? "s" : ""}` });
  return (
    <div className="itin-day" ref={cardRef}>
      {/* Date rail */}
      <div className="itin-day-rail">
        <div className="itin-day-num">DAY {day.dayNumber < 10 ? `0${day.dayNumber}` : day.dayNumber}</div>
        {formattedDate && <div className="itin-day-date">{formattedDate}</div>}
      </div>

      {/* Body with timeline connector */}
      <div className="itin-day-body">
        <span className={`itin-day-node ${documented ? "on" : ""}`} />

        <div className="itin-card">
          <div className="itin-card-head">
            <div style={{ minWidth: 0 }}>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 750, color: "var(--text-primary, #fff)" }}>
                {day.title || (hasDetails ? "Day Itinerary" : "No itinerary details yet")}
              </h4>
              {place && (
                <div style={{ fontSize: "13px", color: "var(--text-secondary, #aaa)", display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                  <MapPin size={13} style={{ color: "var(--accent, #ff6600)", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{place}</span>
                </div>
              )}
            </div>

            <div className="itin-card-actions">
              {costLabel && <span className="itin-cost-badge">{costLabel}</span>}
              <button type="button" className="itin-iconbtn" onClick={onEdit} title="Edit day" aria-label={`Edit Day ${day.dayNumber}`}>
                <Edit2 size={15} />
              </button>
              <button type="button" className="itin-iconbtn danger" onClick={onDelete} title="Delete day" aria-label={`Delete Day ${day.dayNumber}`}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Glance summary + weather/mood */}
          {(glance.length > 0 || day.weather || day.mood) && (
            <div className="itin-glance">
              {glance.map((g, i) => (
                <span key={i} className="itin-glance-chip">
                  {g.icon}
                  <span>{g.label}</span>
                </span>
              ))}
              {day.weather && (
                <span className="itin-glance-chip">
                  <CloudSun size={11} />
                  <span>{day.weather}</span>
                </span>
              )}
              {day.mood ? (
                <span className="itin-glance-chip" style={{ color: "#f59e0b" }}>
                  <Smile size={11} />
                  <span>{"★".repeat(day.mood)}</span>
                </span>
              ) : null}
            </div>
          )}
          {!hasDetails ? (
            <div style={{ marginTop: "10px" }}>
              <button type="button" className="trip-ghost-btn" onClick={onEdit} style={{ fontSize: "12px", padding: "6px 12px" }}>
                <Plus size={13} />
                <span>Add details</span>
              </button>
            </div>
          ) : (
            <div className="itin-sections">
              {/* TRANSPORT */}
              {parsed.transport.length > 0 && (
                <section>
                  <div className="itin-sec-label">
                    <Navigation size={12} style={{ color: "var(--accent, #ff6600)" }} />
                    <span>Transport</span>
                  </div>
                  <div className="itin-items">
                    {parsed.transport.map((leg) => {
                      const fromName = resolveLocName(leg.fromLocationId, leg.fromName);
                      const toName = resolveLocName(leg.toLocationId, leg.toName);
                      const waypointNames = (leg.waypoints || [])
                        .map((wp) => resolveLocName(wp.locationId, wp.name))
                        .filter(Boolean);
                      const stops = [fromName, ...waypointNames, toName].filter(Boolean);
                      const cost = formatMoney(leg.cost, leg.currency);
                      return (
                        <div key={leg.id} className="itin-item">
                          <span className="itin-item-ico">
                            <Navigation size={13} style={{ color: "var(--accent, #ff6600)" }} />
                          </span>
                          <div className="itin-item-main">
                            <span className="itin-item-label">{leg.mode}</span>
                            {stops.length > 0 && (
                              <span className="itin-route">
                                {stops.map((s, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span className="itin-stop-sep">›</span>}
                                    <span className="itin-stop">{s}</span>
                                  </React.Fragment>
                                ))}
                              </span>
                            )}
                          </div>
                          {cost && <span className="itin-cost">{cost}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {/* FOOD */}
              {parsed.meals.length > 0 && (
                <section>
                  <div className="itin-sec-label">
                    <Utensils size={12} style={{ color: "#f59e0b" }} />
                    <span>Food</span>
                  </div>
                  <div className="itin-items">
                    {parsed.meals.map((meal) => {
                      const mealPlace = resolveLocName(meal.placeLocationId, meal.place);
                      const cost = formatMoney(meal.cost, meal.currency);
                      return (
                        <div key={meal.id} className="itin-item">
                          <span className="itin-item-ico">
                            <Utensils size={13} style={{ color: "#f59e0b" }} />
                          </span>
                          <div className="itin-item-main">
                            <span className="itin-item-label">{meal.type}</span>
                            {mealPlace && <span>@ {mealPlace}</span>}
                            {meal.dishes && <span style={{ color: "var(--text-muted, #888)" }}>({meal.dishes})</span>}
                            {meal.rating ? <span style={{ color: "#f59e0b" }}>{"★".repeat(meal.rating)}</span> : null}
                          </div>
                          {cost && <span className="itin-cost">{cost}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ACTIVITIES */}
              {parsed.activities.length > 0 && (
                <section>
                  <div className="itin-sec-label">
                    <MapPin size={12} style={{ color: "#3b82f6" }} />
                    <span>Activities</span>
                  </div>
                  <div className="itin-items">
                    {parsed.activities.map((act) => {
                      const actLocation = resolveLocName(act.locationId, act.locationName);
                      const cost = formatMoney(act.cost, act.currency);
                      return (
                        <div key={act.id} className="itin-item">
                          <span className="itin-item-ico">
                            <MapPin size={13} style={{ color: "#3b82f6" }} />
                          </span>
                          <div className="itin-item-main">
                            <span className="itin-item-label" style={{ textTransform: "none" }}>{act.title || "Activity"}</span>
                            {actLocation && <span>({actLocation})</span>}
                            {act.time && <span style={{ color: "var(--text-muted, #888)" }}>· {act.time}</span>}
                          </div>
                          {cost && <span className="itin-cost">{cost}</span>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              {/* STAY */}
              {hasAccommodation && (
                <section>
                  <div className="itin-sec-label">
                    <Bed size={12} style={{ color: "#8b5cf6" }} />
                    <span>Stay</span>
                  </div>
                  <div className="itin-items">
                    <div className="itin-item">
                      <span className="itin-item-ico">
                        <Bed size={13} style={{ color: "#8b5cf6" }} />
                      </span>
                      <div className="itin-item-main">
                        <span className="itin-item-label" style={{ textTransform: "none" }}>
                          {accommodationName || "Accommodation"}
                        </span>
                      </div>
                      {accommodationCost && <span className="itin-cost">{accommodationCost}</span>}
                    </div>
                  </div>
                </section>
              )}

              {/* NOTES */}
              {day.notesMarkdown && (
                <section>
                  <div className="itin-sec-label">
                    <FileText size={12} />
                    <span>Notes</span>
                  </div>
                  <div className="itin-note">{day.notesMarkdown}</div>
                </section>
              )}

              {/* PHOTOS */}
              {parsed.photos.length > 0 && (
                <section>
                  <div className="itin-sec-label">
                    <Camera size={12} />
                    <span>Photos</span>
                  </div>
                  <div className="itin-photos">
                    {parsed.photos.slice(0, 10).map((p) => (
                      <img key={p.id} src={p.url} alt={p.caption || "Trip day photo"} className="itin-photo" loading="lazy" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
