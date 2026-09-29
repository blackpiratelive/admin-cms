"use client";

import { useState, useEffect } from "react";
import { LocationRecord, TripDayRecord } from "@/db/schema";
import { updateTripDayAction } from "@/features/trips/day-actions";
import {
  TransportLeg,
  MealEntry,
  ActivityEntry,
  Accommodation,
  DayPhoto,
  TRANSPORT_MODES,
  MEAL_TYPES,
  parseTripDay,
} from "@/features/trips/day-helpers";
import { notify } from "@/lib/notifications";
import { CloudinaryImageUploader } from "@/features/media/CloudinaryImageUploader";
import { X, Plus, Trash2 } from "lucide-react";

interface TripDayEditorModalProps {
  isOpen: boolean;
  day: TripDayRecord | null;
  locations: LocationRecord[];
  onClose: () => void;
  onSaved?: () => void;
}

function rowId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

// Select an existing Location, or type a free-text place name as a fallback.
function LocationPickerField({
  locations,
  locationId,
  name,
  onChange,
  placeholder,
}: {
  locations: LocationRecord[];
  locationId?: string;
  name?: string;
  onChange: (next: { locationId?: string; name?: string }) => void;
  placeholder?: string;
}) {
  const isCustom = !locationId;
  return (
    <div style={{ display: "flex", gap: "6px" }}>
      <select
        className="form-input"
        style={{ flex: "0 0 46%" }}
        value={locationId || ""}
        onChange={(e) =>
          onChange(
            e.target.value
              ? { locationId: e.target.value, name: undefined }
              : { locationId: undefined, name }
          )
        }
      >
        <option value="">Custom…</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {isCustom && (
        <input
          type="text"
          className="form-input"
          style={{ flex: 1 }}
          value={name || ""}
          onChange={(e) => onChange({ locationId: undefined, name: e.target.value })}
          placeholder={placeholder || "Type a place"}
        />
      )}
    </div>
  );
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

export function TripDayEditorModal({ isOpen, day, locations, onClose, onSaved }: TripDayEditorModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [primaryLocationId, setPrimaryLocationId] = useState<string | undefined>(undefined);
  const [primaryLocationName, setPrimaryLocationName] = useState<string | undefined>(undefined);
  const [transport, setTransport] = useState<TransportLeg[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [accommodation, setAccommodation] = useState<Accommodation>({});
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [weather, setWeather] = useState("");
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!day) return;
    const parsed = parseTripDay(day);
    setTitle(day.title || "");
    setDate(day.date || "");
    setPrimaryLocationId(day.primaryLocationId || undefined);
    setPrimaryLocationName(day.primaryLocationName || undefined);
    setTransport(parsed.transport);
    setMeals(parsed.meals);
    setActivities(parsed.activities);
    setAccommodation(parsed.accommodation || {});
    setPhotos(parsed.photos);
    setWeather(day.weather || "");
    setMood(day.mood != null ? String(day.mood) : "");
    setNotes(day.notesMarkdown || "");
  }, [day, isOpen]);

  if (!isOpen || !day) return null;

  const handleSave = () => {
    const dayId = day.id;
    const label = title.trim() || (date ? date : `Day ${day.dayNumber}`);
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
          primaryLocationName: primaryLocationId ? null : primaryLocationName || null,
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
        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: "680px", maxHeight: "90vh", backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)", borderRadius: "8px", display: "flex",
          flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
            Day {day.dayNumber}{date ? ` · ${date}` : ""}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-form" style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label className="form-label">Day Title</label>
              <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Arrival in Kolkata" />
            </div>
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: "4px" }}>
            <label className="form-label">Primary Location</label>
            <LocationPickerField
              locations={locations}
              locationId={primaryLocationId}
              name={primaryLocationName}
              onChange={(next) => {
                setPrimaryLocationId(next.locationId);
                setPrimaryLocationName(next.name);
              }}
              placeholder="e.g. Kolkata"
            />
          </div>

          {/* Transport legs */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "13px" }}>Transport</strong>
              <button type="button" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={() => setTransport((t) => [...t, { id: rowId("trn"), mode: "train" }])}>
                <Plus size={13} /> <span>Add leg</span>
              </button>
            </div>
            {transport.map((leg, i) => {
              const upd = (patch: Partial<TransportLeg>) =>
                setTransport((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
              return (
                <div key={leg.id} style={rowStyle}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <select className="form-input" style={{ flex: "0 0 30%" }} value={leg.mode}
                      onChange={(e) => upd({ mode: e.target.value as TransportLeg["mode"] })}>
                      {TRANSPORT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="text" className="form-input" style={{ flex: 1 }} value={leg.fromName || ""}
                      onChange={(e) => upd({ fromName: e.target.value, fromLocationId: undefined })} placeholder="From" />
                    <input type="text" className="form-input" style={{ flex: 1 }} value={leg.toName || ""}
                      onChange={(e) => upd({ toName: e.target.value, toLocationId: undefined })} placeholder="To" />
                    <button type="button" onClick={() => setTransport((rows) => rows.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 size={15} /></button>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="time" className="form-input" style={{ flex: 1 }} value={leg.departTime || ""} onChange={(e) => upd({ departTime: e.target.value })} />
                    <input type="time" className="form-input" style={{ flex: 1 }} value={leg.arriveTime || ""} onChange={(e) => upd({ arriveTime: e.target.value })} />
                    <input type="number" step="any" className="form-input" style={{ flex: 1 }} value={leg.cost ?? ""} onChange={(e) => upd({ cost: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Cost" />
                    <input type="text" className="form-input" style={{ flex: "0 0 70px" }} value={leg.currency || ""} onChange={(e) => upd({ currency: e.target.value })} placeholder="₹/$" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meals */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "13px" }}>Meals</strong>
              <button type="button" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={() => setMeals((m) => [...m, { id: rowId("meal"), type: "lunch" }])}>
                <Plus size={13} /> <span>Add meal</span>
              </button>
            </div>
            {meals.map((meal, i) => {
              const upd = (patch: Partial<MealEntry>) =>
                setMeals((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
              return (
                <div key={meal.id} style={rowStyle}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <select className="form-input" style={{ flex: "0 0 28%" }} value={meal.type}
                      onChange={(e) => upd({ type: e.target.value as MealEntry["type"] })}>
                      {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="text" className="form-input" style={{ flex: 1 }} value={meal.place || ""} onChange={(e) => upd({ place: e.target.value })} placeholder="Place" />
                    <input type="number" min={1} max={5} className="form-input" style={{ flex: "0 0 70px" }} value={meal.rating ?? ""} onChange={(e) => upd({ rating: e.target.value ? parseInt(e.target.value, 10) : undefined })} placeholder="1-5" />
                    <button type="button" onClick={() => setMeals((rows) => rows.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 size={15} /></button>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="text" className="form-input" style={{ flex: 1 }} value={meal.dishes || ""} onChange={(e) => upd({ dishes: e.target.value })} placeholder="Dishes" />
                    <input type="number" step="any" className="form-input" style={{ flex: "0 0 90px" }} value={meal.cost ?? ""} onChange={(e) => upd({ cost: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Cost" />
                    <input type="text" className="form-input" style={{ flex: "0 0 70px" }} value={meal.currency || ""} onChange={(e) => upd({ currency: e.target.value })} placeholder="₹/$" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activities */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <strong style={{ fontSize: "13px" }}>Activities</strong>
              <button type="button" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={() => setActivities((a) => [...a, { id: rowId("act"), title: "" }])}>
                <Plus size={13} /> <span>Add activity</span>
              </button>
            </div>
            {activities.map((act, i) => {
              const upd = (patch: Partial<ActivityEntry>) =>
                setActivities((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
              return (
                <div key={act.id} style={rowStyle}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input type="text" className="form-input" style={{ flex: 1 }} value={act.title} onChange={(e) => upd({ title: e.target.value })} placeholder="What did you do?" />
                    <input type="time" className="form-input" style={{ flex: "0 0 110px" }} value={act.time || ""} onChange={(e) => upd({ time: e.target.value })} />
                    <input type="number" step="any" className="form-input" style={{ flex: "0 0 90px" }} value={act.cost ?? ""} onChange={(e) => upd({ cost: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Cost" />
                    <button type="button" onClick={() => setActivities((rows) => rows.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accommodation */}
          <div style={sectionStyle}>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "10px" }}>Accommodation</strong>
            <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
              <input type="text" className="form-input" style={{ flex: 1 }} value={accommodation.name || ""} onChange={(e) => setAccommodation((a) => ({ ...a, name: e.target.value }))} placeholder="Hotel / stay name" />
              <input type="number" step="any" className="form-input" style={{ flex: "0 0 100px" }} value={accommodation.cost ?? ""} onChange={(e) => setAccommodation((a) => ({ ...a, cost: e.target.value ? parseFloat(e.target.value) : undefined }))} placeholder="Cost" />
              <input type="text" className="form-input" style={{ flex: "0 0 70px" }} value={accommodation.currency || ""} onChange={(e) => setAccommodation((a) => ({ ...a, currency: e.target.value }))} placeholder="₹/$" />
            </div>
            <input type="text" className="form-input" value={accommodation.notes || ""} onChange={(e) => setAccommodation((a) => ({ ...a, notes: e.target.value }))} placeholder="Notes (room, booking ref…)" />
          </div>

          {/* Weather + Mood */}
          <div style={sectionStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="form-label">Weather</label>
                <input type="text" className="form-input" value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="e.g. Sunny 28°C" />
              </div>
              <div>
                <label className="form-label">Mood (1-5)</label>
                <select className="form-input" value={mood} onChange={(e) => setMood(e.target.value)}>
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
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
                  <div key={p.id} style={{ position: "relative", width: "80px", height: "80px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={p.url} alt={p.caption || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => setPhotos((rows) => rows.filter((r) => r.id !== p.id))}
                      style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer", display: "flex", padding: "2px" }}>
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
            <textarea className="form-input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Free-form notes for the day (markdown)…" />
          </div>

        </div>

        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Save Day</button>
        </div>
      </div>
    </div>
  );
}
