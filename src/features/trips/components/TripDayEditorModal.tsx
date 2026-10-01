"use client";

import { useState, useEffect } from "react";
import { TripDayRecord } from "@/db/schema";
import type { LocationPickerOption } from "@/features/pickers/types";
import { LocationPickerField } from "@/features/locations/components/LocationPickerField";
import { updateTripDayAction } from "@/features/trips/day-actions";
import {
  TransportLeg,
  TransportWaypoint,
  MealEntry,
  ActivityEntry,
  Accommodation,
  DayPhoto,
  TRANSPORT_MODES,
  MEAL_TYPES,
  parseTripDay,
  computeLegDistanceKm,
} from "@/features/trips/day-helpers";
import { notify } from "@/lib/notifications";
import { CloudinaryImageUploader } from "@/features/media/CloudinaryImageUploader";
import { X, Plus, Trash2, MapPin, ChevronUp, ChevronDown } from "lucide-react";

interface TripDayEditorModalProps {
  isOpen: boolean;
  day: TripDayRecord | null;
  locations: LocationPickerOption[];
  tripLocationIds?: string[];
  locationRecentIds?: string[];
  onClose: () => void;
  onSaved?: () => void;
}

function rowId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

const sectionStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border-color)",
  paddingTop: "14px",
  marginTop: "14px",
};
const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "10px",
};
const rowStyle: React.CSSProperties = {
  border: "1px solid var(--border-color)",
  borderRadius: "6px",
  padding: "10px",
  marginBottom: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

export function TripDayEditorModal({
  isOpen,
  day,
  locations,
  tripLocationIds,
  locationRecentIds,
  onClose,
  onSaved,
}: TripDayEditorModalProps) {
  const [allLocations, setAllLocations] = useState<LocationPickerOption[]>(locations);
  const [localTripLocIds, setLocalTripLocIds] = useState<string[]>(tripLocationIds || []);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [primaryLocationId, setPrimaryLocationId] = useState<string | undefined>(undefined);
  const [primaryLocationName, setPrimaryLocationName] = useState<string | undefined>(undefined);
  const [primaryLocationLat, setPrimaryLocationLat] = useState<number | null>(null);
  const [primaryLocationLng, setPrimaryLocationLng] = useState<number | null>(null);
  const [transport, setTransport] = useState<TransportLeg[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [accommodation, setAccommodation] = useState<Accommodation>({});
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [weather, setWeather] = useState("");
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setAllLocations(locations);
  }, [locations]);

  useEffect(() => {
    setLocalTripLocIds(tripLocationIds || []);
  }, [tripLocationIds]);

  useEffect(() => {
    if (!day) return;
    const parsed = parseTripDay(day);
    setTitle(day.title || "");
    setDate(day.date || "");
    setPrimaryLocationId(day.primaryLocationId || undefined);
    setPrimaryLocationName(day.primaryLocationName || undefined);
    setPrimaryLocationLat(day.primaryLocationLat ?? null);
    setPrimaryLocationLng(day.primaryLocationLng ?? null);
    setTransport(parsed.transport);
    setMeals(parsed.meals);
    setActivities(parsed.activities);
    setAccommodation(parsed.accommodation || {});
    setPhotos(parsed.photos);
    setWeather(day.weather || "");
    setMood(day.mood != null ? String(day.mood) : "");
    setNotes(day.notesMarkdown || "");
  }, [day, isOpen]);

  const handleLocationCreated = (newLoc: LocationPickerOption) => {
    setAllLocations((prev) => {
      if (prev.some((l) => l.id === newLoc.id)) return prev;
      return [newLoc, ...prev];
    });
    setLocalTripLocIds((prev) => {
      if (prev.includes(newLoc.id)) return prev;
      return [newLoc.id, ...prev];
    });
  };

  if (!isOpen || !day) return null;

  const handleSave = () => {
    const dayId = day.id;
    const label = title.trim() || (date ? date : `Day ${day.dayNumber}`);
    const resolvedPrimaryName = primaryLocationId
      ? allLocations.find((l) => l.id === primaryLocationId)?.name || primaryLocationName || null
      : primaryLocationName || null;

    onClose();
    notify.bg({
      title: "Save Itinerary Day",
      loadingMessage: `Saving '${label}' in background...`,
      successMessage: `Day '${label}' saved!`,
      errorMessage: (err) => `Failed to save day: ${err?.message || String(err)}`,
      task: () =>
        updateTripDayAction(dayId, {
          title: title.trim() || null,
          date: date || null,
          primaryLocationId: primaryLocationId || null,
          primaryLocationName: resolvedPrimaryName,
          primaryLocationLat,
          primaryLocationLng,
          transport,
          meals,
          activities,
          accommodation,
          photos,
          weather: weather.trim() || null,
          mood: mood ? parseInt(mood, 10) : null,
          notesMarkdown: notes.trim() || null,
        }),
      onSuccess: () => onSaved?.(),
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
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
          maxWidth: "720px",
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
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
            Day {day.dayNumber}
            {date ? ` · ${date}` : ""}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-form" style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Day Title</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Arrival in Kolkata"
              />
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: "4px" }}>
            <label className="form-label">Primary Location</label>
            <LocationPickerField
              locations={allLocations}
              priorityIds={localTripLocIds}
              recentIds={locationRecentIds}
              locationId={primaryLocationId}
              name={primaryLocationName}
              latitude={primaryLocationLat}
              longitude={primaryLocationLng}
              tripId={day.tripId}
              onChange={(next) => {
                setPrimaryLocationId(next.locationId);
                setPrimaryLocationName(next.name);
                setPrimaryLocationLat(next.latitude ?? null);
                setPrimaryLocationLng(next.longitude ?? null);
              }}
              onLocationCreated={handleLocationCreated}
              placeholder="e.g. Kolkata"
            />
          </div>

          {/* Transport legs */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "13px" }}>Transport</strong>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={() => setTransport((t) => [...t, { id: rowId("trn"), mode: "train" }])}
              >
                <Plus size={13} /> <span>Add leg</span>
              </button>
            </div>
            {transport.map((leg, i) => {
              const upd = (patch: Partial<TransportLeg>) =>
                setTransport((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
              // Coordinate-derived estimate (ignores any manual override) used as the
              // placeholder, so the user sees the auto distance and can override it.
              const estKm = computeLegDistanceKm({ ...leg, distanceKm: undefined });
              const estLabel =
                estKm != null ? `≈ ${estKm < 10 ? estKm.toFixed(1) : Math.round(estKm)}` : "km";
              return (
                <div key={leg.id} style={rowStyle}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <select
                      className="form-input"
                      style={{ flex: "0 0 28%" }}
                      value={leg.mode}
                      onChange={(e) => upd({ mode: e.target.value as TransportLeg["mode"] })}
                    >
                      {TRANSPORT_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <LocationPickerField
                        locations={allLocations}
                        priorityIds={localTripLocIds}
                        recentIds={locationRecentIds}
                        locationId={leg.fromLocationId}
                        name={leg.fromName}
                        latitude={leg.fromLat}
                        longitude={leg.fromLng}
                        tripId={day.tripId}
                        placeholder="From"
                        onChange={(next) =>
                          upd({
                            fromLocationId: next.locationId,
                            fromName: next.name,
                            fromLat: next.latitude,
                            fromLng: next.longitude,
                          })
                        }
                        onLocationCreated={handleLocationCreated}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <LocationPickerField
                        locations={allLocations}
                        priorityIds={localTripLocIds}
                        recentIds={locationRecentIds}
                        locationId={leg.toLocationId}
                        name={leg.toName}
                        latitude={leg.toLat}
                        longitude={leg.toLng}
                        tripId={day.tripId}
                        placeholder="To"
                        onChange={(next) =>
                          upd({
                            toLocationId: next.locationId,
                            toName: next.name,
                            toLat: next.latitude,
                            toLng: next.longitude,
                          })
                        }
                        onLocationCreated={handleLocationCreated}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTransport((rows) => rows.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Intermediate Waypoints (Via stops) */}
                  {leg.waypoints && leg.waypoints.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        padding: "6px 8px",
                        background: "rgba(255, 102, 0, 0.04)",
                        border: "1px dashed rgba(255, 102, 0, 0.2)",
                        borderRadius: "6px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--accent, #ff6600)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <MapPin size={11} /> Via Intermediate Stops ({leg.waypoints.length})
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: "2px 6px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          onClick={() => {
                            const curWps = leg.waypoints || [];
                            upd({
                              waypoints: [
                                ...curWps,
                                { id: rowId("wp"), locationId: undefined, name: "", latitude: null, longitude: null },
                              ],
                            });
                          }}
                        >
                          <Plus size={11} /> <span>Add via</span>
                        </button>
                      </div>
                      {leg.waypoints.map((wp, wpIdx) => (
                        <div key={wp.id} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "var(--text-muted, #888)",
                              width: "36px",
                              flexShrink: 0,
                              textAlign: "right",
                            }}
                          >
                            #{wpIdx + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <LocationPickerField
                              locations={allLocations}
                              priorityIds={localTripLocIds}
                              recentIds={locationRecentIds}
                              locationId={wp.locationId}
                              name={wp.name}
                              latitude={wp.latitude}
                              longitude={wp.longitude}
                              tripId={day.tripId}
                              placeholder="Intermediate city or station..."
                              onChange={(next) => {
                                const nextWps = [...(leg.waypoints || [])];
                                nextWps[wpIdx] = {
                                  ...nextWps[wpIdx],
                                  locationId: next.locationId,
                                  name: next.name,
                                  latitude: next.latitude,
                                  longitude: next.longitude,
                                };
                                upd({ waypoints: nextWps });
                              }}
                              onLocationCreated={handleLocationCreated}
                            />
                          </div>
                          {wpIdx > 0 && (
                            <button
                              type="button"
                              title="Move Up"
                              onClick={() => {
                                const nextWps = [...(leg.waypoints || [])];
                                const tmp = nextWps[wpIdx - 1];
                                nextWps[wpIdx - 1] = nextWps[wpIdx];
                                nextWps[wpIdx] = tmp;
                                upd({ waypoints: nextWps });
                              }}
                              style={{ background: "none", border: "none", color: "var(--text-muted, #888)", cursor: "pointer", padding: "2px" }}
                            >
                              <ChevronUp size={13} />
                            </button>
                          )}
                          {wpIdx < leg.waypoints!.length - 1 && (
                            <button
                              type="button"
                              title="Move Down"
                              onClick={() => {
                                const nextWps = [...(leg.waypoints || [])];
                                const tmp = nextWps[wpIdx + 1];
                                nextWps[wpIdx + 1] = nextWps[wpIdx];
                                nextWps[wpIdx] = tmp;
                                upd({ waypoints: nextWps });
                              }}
                              style={{ background: "none", border: "none", color: "var(--text-muted, #888)", cursor: "pointer", padding: "2px" }}
                            >
                              <ChevronDown size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Remove via stop"
                            onClick={() => {
                              const nextWps = leg.waypoints!.filter((_, idx) => idx !== wpIdx);
                              upd({ waypoints: nextWps });
                            }}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          padding: "2px 8px",
                          fontSize: "11px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--text-muted, #888)",
                        }}
                        onClick={() => {
                          upd({
                            waypoints: [
                              { id: rowId("wp"), locationId: undefined, name: "", latitude: null, longitude: null },
                            ],
                          });
                        }}
                      >
                        <Plus size={11} /> <span>+ Add via / intermediate stop</span>
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="time"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={leg.departTime || ""}
                      onChange={(e) => upd({ departTime: e.target.value })}
                    />
                    <input
                      type="time"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={leg.arriveTime || ""}
                      onChange={(e) => upd({ arriveTime: e.target.value })}
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={leg.cost ?? ""}
                      onChange={(e) => upd({ cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Cost"
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: "0 0 70px" }}
                      value={leg.currency || ""}
                      onChange={(e) => upd({ currency: e.target.value })}
                      placeholder="₹/$"
                    />
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="form-input"
                      style={{ flex: "0 0 90px" }}
                      value={leg.distanceKm ?? ""}
                      onChange={(e) => upd({ distanceKm: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder={estLabel}
                      title="Distance in km (leave blank to auto-estimate from coordinates)"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meals */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "13px" }}>Meals</strong>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={() => setMeals((m) => [...m, { id: rowId("meal"), type: "lunch" }])}
              >
                <Plus size={13} /> <span>Add meal</span>
              </button>
            </div>
            {meals.map((meal, i) => {
              const upd = (patch: Partial<MealEntry>) =>
                setMeals((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
              return (
                <div key={meal.id} style={rowStyle}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <select
                      className="form-input"
                      style={{ flex: "0 0 25%" }}
                      value={meal.type}
                      onChange={(e) => upd({ type: e.target.value as MealEntry["type"] })}
                    >
                      {MEAL_TYPES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <LocationPickerField
                        locations={allLocations}
                        priorityIds={localTripLocIds}
                        recentIds={locationRecentIds}
                        locationId={meal.placeLocationId}
                        name={meal.place}
                        latitude={meal.lat}
                        longitude={meal.lng}
                        tripId={day.tripId}
                        placeholder="Restaurant / place"
                        onChange={(next) =>
                          upd({
                            placeLocationId: next.locationId,
                            place: next.name,
                            lat: next.latitude,
                            lng: next.longitude,
                          })
                        }
                        onLocationCreated={handleLocationCreated}
                      />
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="form-input"
                      style={{ flex: "0 0 70px" }}
                      value={meal.rating ?? ""}
                      onChange={(e) => upd({ rating: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="1-5"
                    />
                    <button
                      type="button"
                      onClick={() => setMeals((rows) => rows.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={meal.dishes || ""}
                      onChange={(e) => upd({ dishes: e.target.value })}
                      placeholder="Dishes"
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      style={{ flex: "0 0 90px" }}
                      value={meal.cost ?? ""}
                      onChange={(e) => upd({ cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Cost"
                    />
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: "0 0 70px" }}
                      value={meal.currency || ""}
                      onChange={(e) => upd({ currency: e.target.value })}
                      placeholder="₹/$"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activities */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "13px" }}>Activities</strong>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={() => setActivities((a) => [...a, { id: rowId("act"), title: "" }])}
              >
                <Plus size={13} /> <span>Add activity</span>
              </button>
            </div>
            {activities.map((act, i) => {
              const upd = (patch: Partial<ActivityEntry>) =>
                setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
              return (
                <div key={act.id} style={rowStyle}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={act.title}
                      onChange={(e) => upd({ title: e.target.value })}
                      placeholder="Activity title"
                    />
                    <input
                      type="time"
                      className="form-input"
                      style={{ flex: "0 0 110px" }}
                      value={act.time || ""}
                      onChange={(e) => upd({ time: e.target.value })}
                    />
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      style={{ flex: "0 0 90px" }}
                      value={act.cost ?? ""}
                      onChange={(e) => upd({ cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Cost"
                    />
                    <button
                      type="button"
                      onClick={() => setActivities((rows) => rows.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div style={{ width: "100%" }}>
                    <LocationPickerField
                      locations={allLocations}
                      priorityIds={localTripLocIds}
                      recentIds={locationRecentIds}
                      locationId={act.locationId}
                      name={act.locationName}
                      latitude={act.lat}
                      longitude={act.lng}
                      tripId={day.tripId}
                      placeholder="Activity location (optional)"
                      onChange={(next) =>
                        upd({
                          locationId: next.locationId,
                          locationName: next.name,
                          lat: next.latitude,
                          lng: next.longitude,
                        })
                      }
                      onLocationCreated={handleLocationCreated}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accommodation */}
          <div style={sectionStyle}>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>Accommodation</strong>
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <LocationPickerField
                  locations={allLocations}
                  priorityIds={localTripLocIds}
                  recentIds={locationRecentIds}
                  locationId={accommodation.locationId}
                  name={accommodation.name || accommodation.locationName}
                  latitude={accommodation.lat}
                  longitude={accommodation.lng}
                  tripId={day.tripId}
                  placeholder="Hotel / stay location"
                  onChange={(next) =>
                    setAccommodation((a) => ({
                      ...a,
                      locationId: next.locationId,
                      name: next.name,
                      locationName: next.name,
                      lat: next.latitude,
                      lng: next.longitude,
                    }))
                  }
                  onLocationCreated={handleLocationCreated}
                />
              </div>
              <input
                type="number"
                step="any"
                className="form-input"
                style={{ flex: "0 0 100px" }}
                value={accommodation.cost ?? ""}
                onChange={(e) =>
                  setAccommodation((a) => ({
                    ...a,
                    cost: e.target.value ? parseFloat(e.target.value) : undefined,
                  }))
                }
                placeholder="Cost"
              />
              <input
                type="text"
                className="form-input"
                style={{ flex: "0 0 70px" }}
                value={accommodation.currency || ""}
                onChange={(e) => setAccommodation((a) => ({ ...a, currency: e.target.value }))}
                placeholder="₹/$"
              />
            </div>
            <input
              type="text"
              className="form-input"
              value={accommodation.notes || ""}
              onChange={(e) => setAccommodation((a) => ({ ...a, notes: e.target.value }))}
              placeholder="Notes (room, booking ref…)"
            />
          </div>

          {/* Weather + Mood */}
          <div style={sectionStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="form-label">Weather</label>
                <input
                  type="text"
                  className="form-input"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  placeholder="e.g. Sunny 28°C"
                />
              </div>
              <div>
                <label className="form-label">Mood (1-5)</label>
                <select className="form-input" value={mood} onChange={(e) => setMood(e.target.value)}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Photos */}
          <div style={sectionStyle}>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>Photos</strong>
            {photos.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                {photos.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      position: "relative",
                      width: "80px",
                      height: "80px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <img src={p.url} alt={p.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => setPhotos((rows) => rows.filter((r) => r.id !== p.id))}
                      style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        background: "rgba(0,0,0,0.6)",
                        border: "none",
                        borderRadius: "4px",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        padding: "2px",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <CloudinaryImageUploader onImageUploaded={(url) => setPhotos((rows) => [...rows, { id: rowId("photo"), url }])} />
          </div>

          {/* Notes */}
          <div style={sectionStyle}>
            <label className="form-label">Journal Notes</label>
            <textarea
              className="form-input"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Free-form notes for the day (markdown)…"
            />
          </div>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Day
          </button>
        </div>
      </div>
    </div>
  );
}
