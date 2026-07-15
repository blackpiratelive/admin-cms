"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TripRecord, LocationRecord, Microblog, GalleryPhoto, PersonRecord } from "@/db/schema";
import {
  getTripHubDataAction,
  deleteTrip,
  connectTripToLocation,
  TripAssociatedEntities,
  TripHubData,
} from "@/features/trips/actions";
import { getLocations, removeLocationTripConnection } from "@/features/locations/actions";
import { TripFormModal } from "@/features/trips/components/TripFormModal";
import {
  ArrowLeft,
  Compass,
  Calendar,
  MapPin,
  Edit2,
  Trash2,
  Image as ImageIcon,
  MessageSquareText,
  Film,
  Users,
  Plus,
  X,
  Lock,
  EyeOff,
  ChevronRight,
  Globe,
} from "lucide-react";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";

export default function TripDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const slug = resolvedParams.slug;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [entities, setEntities] = useState<TripAssociatedEntities | null>(null);
  const [availableLocations, setAvailableLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Selectors
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLocToConnect, setSelectedLocToConnect] = useState("");
  const [connectingLoc, setConnectingLoc] = useState(false);
  const [activeTab, setActiveTab] = useState<"locations" | "photos" | "microblogs" | "movies" | "people">("locations");

  const loadTripData = useCallback(async () => {
    const cacheKey = `swr_trip_detail_${slug}`;
    const cached = getBrowserCache<TripHubData>(cacheKey);

    if (cached) {
      setTrip(cached.trip);
      setEntities(cached.entities);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await getTripHubDataAction(slug);
      if (data && data.trip) {
        setTrip(data.trip);
        setEntities(data.entities);
        setBrowserCache(cacheKey, data);
      }
    } catch (err) {
      console.error("Error loading trip detail:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadAvailableLocations = async () => {
    if (availableLocations.length === 0) {
      const locs = await getLocations();
      setAvailableLocations(locs);
    }
  };

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading trip details...</div>;
  }

  if (!trip) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Trip record not found</h2>
        <Link href="/trips" className="btn btn-primary" style={{ marginTop: "12px", display: "inline-flex" }}>
          <ArrowLeft size={16} />
          <span>Back to Trips</span>
        </Link>
      </div>
    );
  }

  const handleLinkLocation = async () => {
    if (!selectedLocToConnect) return;
    setConnectingLoc(true);
    await connectTripToLocation(trip.id, selectedLocToConnect);
    setSelectedLocToConnect("");
    setConnectingLoc(false);
    loadTripData();
  };

  const handleUnlinkLocation = async (relId?: string) => {
    if (!relId) return;
    if (confirm("Disconnect this location from this trip?")) {
      await removeLocationTripConnection(relId, undefined, trip.slug);
      loadTripData();
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete trip "${trip.title}"?`)) {
      await deleteTrip(trip.id);
      router.push("/trips");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Breadcrumb & Actions Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/trips" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={14} />
          <span>Back to Trips</span>
        </Link>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 size={15} />
            <span>Edit Trip</span>
          </button>
          <button className="btn btn-secondary" onClick={handleDelete} style={{ color: "#ef4444" }}>
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Hero Trip Banner Card */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Compass size={24} style={{ color: "var(--accent)" }} />
              <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>{trip.title}</h1>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  backgroundColor: trip.status === "completed" ? "rgba(46, 125, 50, 0.15)" : "rgba(245, 158, 11, 0.15)",
                  color: trip.status === "completed" ? "#2e7d32" : "#f59e0b",
                }}
              >
                {trip.status}
              </span>
            </div>

            {trip.description && (
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "8px", margin: "8px 0 0 0" }}>
                {trip.description}
              </p>
            )}
          </div>

          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            {trip.visibility === "private" && <Lock size={12} />}
            {trip.visibility === "unlisted" && <EyeOff size={12} />}
            <span style={{ textTransform: "capitalize" }}>{trip.visibility}</span>
          </span>
        </div>

        {(trip.startDate || trip.endDate) && (
          <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <Calendar size={15} style={{ color: "var(--accent)" }} />
            <span>{[trip.startDate, trip.endDate].filter(Boolean).join(" to ")}</span>
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "16px" }}>
        <button
          onClick={() => setActiveTab("locations")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "locations" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "locations" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "locations" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <MapPin size={16} />
          <span>Locations Visited ({entities?.associatedLocations.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("photos")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "photos" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "photos" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "photos" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ImageIcon size={16} />
          <span>Photos ({entities?.photos.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("microblogs")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "microblogs" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "microblogs" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "microblogs" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <MessageSquareText size={16} />
          <span>Microblogs ({entities?.microblogs.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("movies")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "movies" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "movies" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "movies" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Film size={16} />
          <span>Movies ({entities?.movies.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("people")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "people" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "people" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "people" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Users size={16} />
          <span>People Joined ({entities?.people.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: LOCATIONS VISITED */}
      {activeTab === "locations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Link Location Selector */}
          <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Link Location to Trip:</span>
            <select className="form-input" value={selectedLocToConnect} onFocus={loadAvailableLocations} onChange={(e) => setSelectedLocToConnect(e.target.value)} style={{ flex: 1 }}>
              <option value="">-- Select Location --</option>
              {availableLocations.map((l) => {
                const locStr = [l.city, l.state, l.country].filter(Boolean).join(", ");
                return (
                  <option key={l.id} value={l.id}>
                    {l.name} {locStr ? `(${locStr})` : ""}
                  </option>
                );
              })}
            </select>
            <button className="btn btn-primary" onClick={handleLinkLocation} disabled={!selectedLocToConnect || connectingLoc}>
              <Plus size={14} />
              <span>Link Location</span>
            </button>
          </div>

          {entities?.associatedLocations.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No locations associated with this trip yet. Select a location above to link it.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {entities?.associatedLocations.map(({ relationshipId, location: loc }) => {
                const fullLocStr = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
                return (
                  <div key={loc.id} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "10px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Link href={`/locations/${loc.slug}`} style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}>
                          {loc.name}
                        </Link>
                        <button onClick={() => handleUnlinkLocation(relationshipId)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                          <X size={14} />
                        </button>
                      </div>
                      {fullLocStr && (
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          <Globe size={14} style={{ color: "var(--text-muted)" }} />
                          <span>{fullLocStr}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                      <Link href={`/locations/${loc.slug}`} style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
                        <span>View Location</span> <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PHOTOS */}
      {activeTab === "photos" && (
        <div>
          {entities?.photos.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No photos recorded for this trip.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {entities?.photos.map((photo) => (
                <div key={photo.id} style={{ borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                  <img src={photo.thumbnailUrl || photo.mediumUrl} alt={photo.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
                  <div style={{ padding: "8px 10px", fontSize: "12px", fontWeight: 600 }}>{photo.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MICROBLOGS */}
      {activeTab === "microblogs" && (
        <div>
          {entities?.microblogs.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No microblogs recorded for this trip.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {entities?.microblogs.map((mb) => (
                <div key={mb.id} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "14px" }}>
                  <div style={{ fontSize: "14px", whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{mb.contentMarkdown}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>Posted: {mb.publishedAt || mb.createdAt}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MOVIES */}
      {activeTab === "movies" && (
        <div>
          {entities?.movies.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No movies recorded for this trip.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
              {entities?.movies.map((m) => (
                <div key={m.traktId} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "12px", display: "flex", gap: "10px" }}>
                  {m.posterPath && <img src={`https://image.tmdb.org/t/p/w185${m.posterPath}`} alt={m.title} style={{ width: "48px", borderRadius: "4px", objectFit: "cover" }} />}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>{m.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.year}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PEOPLE */}
      {activeTab === "people" && (
        <div>
          {entities?.people.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No contacts connected to this trip.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
              {entities?.people.map(({ person }) => (
                <Link key={person.id} href={`/people/${person.slug}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "6px", padding: "12px", display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}>
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt={person.displayName} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      {person.displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{person.displayName}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{person.relationshipType}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Form Modal */}
      <TripFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        tripToEdit={trip}
        onSuccess={loadTripData}
      />
    </div>
  );
}
