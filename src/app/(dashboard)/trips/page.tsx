"use client";

import { useState, useEffect } from "react";
import { getTrips, createTrip, deleteTrip } from "@/features/trips/actions";
import { TripRecord } from "@/db/schema";
import { Compass, Plus, Trash2, Calendar, Tag } from "lucide-react";

export default function TripsPage() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"planned" | "ongoing" | "completed" | "cancelled">("planned");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTrips();
      setTrips(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createTrip({
      title: title.trim(),
      description: description.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
    });

    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setStatus("planned");
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete trip?")) {
      await deleteTrip(id);
      loadData();
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass size={24} style={{ color: "var(--accent-color, #ff6600)" }} />
            <span>Trips</span>
          </h1>
          <p style={{ color: "var(--text-muted, #888)", fontSize: "14px", marginTop: "4px" }}>
            Group locations, photos, microblogs, and travel notes into trip entities.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Plus size={16} />
          <span>New Trip</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: "var(--card-bg, #1a1a1a)",
            border: "1px solid var(--border-color, #333)",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "24px",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Add Trip</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Trip Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Japan 2028 Exploration"
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              >
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
                style={{ width: "100%", marginTop: "4px" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of the journey, primary destinations..."
              className="input"
              style={{ width: "100%", marginTop: "4px", height: "60px" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary">
              Save Trip
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div>Loading trips...</div>
      ) : trips.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted, #888)" }}>
          No trips recorded yet. Click "New Trip" to create one.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {trips.map((t) => (
            <div
              key={t.id}
              style={{
                backgroundColor: "var(--card-bg, #1a1a1a)",
                border: "1px solid var(--border-color, #333)",
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600 }}>{t.title}</h3>
                  <button
                    onClick={() => handleDelete(t.id)}
                    style={{ background: "none", border: "none", color: "#e53e3e", cursor: "cursor" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {t.description && (
                  <p style={{ fontSize: "13px", color: "var(--text-muted, #888)", marginTop: "6px" }}>
                    {t.description}
                  </p>
                )}
                {(t.startDate || t.endDate) && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
                    <Calendar size={14} />
                    <span>{[t.startDate, t.endDate].filter(Boolean).join(" to ")}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid var(--border-color, #333)", fontSize: "11px", color: "var(--text-muted, #888)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    backgroundColor: t.status === "completed" ? "rgba(72,187,120,0.2)" : "rgba(237,137,54,0.2)",
                    color: t.status === "completed" ? "#48bb78" : "#ed8936",
                  }}
                >
                  {t.status}
                </span>
                <span>{t.visibility}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
