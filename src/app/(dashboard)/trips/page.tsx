"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getTrips, deleteTrip } from "@/features/trips/actions";
import { TripRecord } from "@/db/schema";
import { TripFormModal } from "@/features/trips/components/TripFormModal";
import { Compass, Plus, Edit2, Trash2, Calendar, ChevronRight, Star } from "lucide-react";

export default function TripsPage() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<TripRecord | null>(null);

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

  const handleCreateNew = () => {
    setTripToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (t: TripRecord, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTripToEdit(t);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this trip?")) {
      await deleteTrip(id);
      loadData();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Compass size={22} style={{ color: "var(--accent)" }} />
            <span>Trips</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Group locations, travel itineraries, photos, microblogs, and media into trip entities.
          </p>
        </div>
        <button onClick={handleCreateNew} className="btn btn-primary">
          <Plus size={16} />
          <span>New Trip</span>
        </button>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "40px", textAlign: "center" }}>
          Loading trips...
        </div>
      ) : trips.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
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
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                color: "var(--text-primary)",
                gap: "14px",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Link
                    href={`/trips/${t.slug}`}
                    style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}
                  >
                    {t.title}
                  </Link>
                  {t.favorite === 1 && <Star size={16} fill="#f59e0b" style={{ color: "#f59e0b" }} />}
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

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Link href={`/trips/${t.slug}`} className="btn btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }}>
                  <span>Trip Hub</span>
                  <ChevronRight size={13} />
                </Link>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      backgroundColor: t.status === "completed" ? "rgba(46, 125, 50, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: t.status === "completed" ? "#2e7d32" : "#f59e0b",
                    }}
                  >
                    {t.status}
                  </span>

                  <button className="btn btn-secondary" onClick={(e) => handleEdit(t, e)} style={{ padding: "4px 8px" }} title="Edit Trip">
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-secondary" onClick={(e) => handleDelete(t.id, e)} style={{ padding: "4px 8px", color: "#ef4444" }} title="Delete Trip">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Form Modal */}
      <TripFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tripToEdit={tripToEdit}
        onSuccess={loadData}
      />
    </div>
  );
}
