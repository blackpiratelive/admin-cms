"use client";

import { useState, useEffect } from "react";
import { getTrips, createTrip, deleteTrip } from "@/features/trips/actions";
import { TripRecord } from "@/db/schema";
import { Compass, Plus, Trash2, Calendar } from "lucide-react";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Compass size={20} style={{ color: "var(--accent)" }} />
            <span>Trips</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Group locations, photos, microblogs, and travel notes into trip entities.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          <span>New Trip</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            padding: "20px",
            borderRadius: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Add Trip</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Trip Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Japan 2028 Exploration"
                className="text-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="select-input"
              >
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: "var(--text-secondary)" }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of the journey, primary destinations..."
              className="text-input"
              style={{ height: "60px", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="submit" className="btn btn-primary">
              Save Trip
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Loading trips...</div>
      ) : trips.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
          No trips recorded yet. Click "New Trip" to create one.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {trips.map((t) => (
            <div
              key={t.id}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                color: "var(--text-primary)",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{t.title}</h3>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="icon-button danger"
                    title="Delete trip"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {t.description && (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
                    {t.description}
                  </p>
                )}
                {(t.startDate || t.endDate) && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
                    <Calendar size={14} />
                    <span>{[t.startDate, t.endDate].filter(Boolean).join(" to ")}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: "16px", paddingTop: "8px", borderTop: "1px solid var(--border-color)", fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "2px",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    backgroundColor: t.status === "completed" ? "#e8f5e9" : "#fff8e1",
                    color: t.status === "completed" ? "#2e7d32" : "#f57f17",
                    border: t.status === "completed" ? "1px solid #c8e6c9" : "1px solid #ffe082",
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
