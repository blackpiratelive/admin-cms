"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getLocations, deleteLocation } from "@/features/locations/actions";
import { LocationRecord } from "@/db/schema";
import { LocationFormModal } from "@/features/locations/components/LocationFormModal";
import { MapPin, Plus, Edit2, Trash2, Camera, Globe, ChevronRight, Star, Lock, EyeOff } from "lucide-react";

export default function LocationsPage() {
  const [locs, setLocs] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<LocationRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLocations();
      setLocs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNew = () => {
    setLocationToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (loc: LocationRecord, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocationToEdit(loc);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this location?")) {
      await deleteLocation(id);
      loadData();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <MapPin size={22} style={{ color: "var(--accent)" }} />
            <span>Locations</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
            Geographical places connected to trips, photos, microblogs, movies, and personal memories.
          </p>
        </div>
        <button onClick={handleCreateNew} className="btn btn-primary">
          <Plus size={16} />
          <span>New Location</span>
        </button>
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "40px", textAlign: "center" }}>
          Loading locations...
        </div>
      ) : locs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
          No locations created yet. Click "New Location" to get started.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {locs.map((loc) => {
            const locationStr = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
            return (
              <div
                key={loc.id}
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
                      href={`/locations/${loc.slug}`}
                      style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}
                    >
                      {loc.name}
                    </Link>
                    {loc.favorite === 1 && <Star size={16} fill="#f59e0b" style={{ color: "#f59e0b" }} />}
                  </div>

                  {locationStr && (
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
                      <Globe size={14} style={{ color: "var(--text-muted)" }} />
                      <span>{locationStr}</span>
                    </div>
                  )}

                  {loc.latitude && loc.longitude && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                      GPS: {loc.latitude}, {loc.longitude}
                    </div>
                  )}

                  {loc.photographyNotes && (
                    <div style={{ marginTop: "10px", fontSize: "12px", backgroundColor: "var(--bg-hover)", padding: "8px 10px", borderRadius: "4px", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent)", fontWeight: 600, marginBottom: "2px" }}>
                        <Camera size={12} /> Photo Notes
                      </div>
                      <div>{loc.photographyNotes}</div>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link href={`/locations/${loc.slug}`} className="btn btn-secondary" style={{ fontSize: "12px", padding: "4px 10px" }}>
                    <span>Location Hub</span>
                    <ChevronRight size={13} />
                  </Link>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button className="btn btn-secondary" onClick={(e) => handleEdit(loc, e)} style={{ padding: "4px 8px" }} title="Edit Location">
                      <Edit2 size={13} />
                    </button>
                    <button className="btn btn-secondary" onClick={(e) => handleDelete(loc.id, e)} style={{ padding: "4px 8px", color: "#ef4444" }} title="Delete Location">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Form Modal */}
      <LocationFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        locationToEdit={locationToEdit}
        onSuccess={loadData}
      />
    </div>
  );
}
