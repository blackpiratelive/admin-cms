"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocationRecord, TripRecord, Microblog, GalleryPhoto, PersonRecord } from "@/db/schema";
import {
  getLocationByIdOrSlug,
  getLocationAssociatedEntities,
  deleteLocation,
  connectLocationToTrip,
  removeLocationTripConnection,
  LocationAssociatedEntities,
} from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import { LocationFormModal } from "@/features/locations/components/LocationFormModal";
import {
  ArrowLeft,
  MapPin,
  Globe,
  Camera,
  Star,
  Edit2,
  Trash2,
  Compass,
  Image as ImageIcon,
  MessageSquareText,
  Film,
  Users,
  Plus,
  X,
  Lock,
  EyeOff,
  ChevronRight,
} from "lucide-react";

export default function LocationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const slug = resolvedParams.slug;

  const [location, setLocation] = useState<LocationRecord | null>(null);
  const [entities, setEntities] = useState<LocationAssociatedEntities | null>(null);
  const [availableTrips, setAvailableTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Links
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTripToConnect, setSelectedTripToConnect] = useState("");
  const [connectingTrip, setConnectingTrip] = useState(false);
  const [activeTab, setActiveTab] = useState<"trips" | "photos" | "microblogs" | "movies" | "people">("trips");

  const loadLocationData = useCallback(async () => {
    setLoading(true);
    try {
      const loc = await getLocationByIdOrSlug(slug);
      if (loc) {
        setLocation(loc);
        const [assocEntities, trps] = await Promise.all([
          getLocationAssociatedEntities(loc.id),
          getTrips(),
        ]);
        setEntities(assocEntities);
        setAvailableTrips(trps);
      }
    } catch (err) {
      console.error("Error loading location details:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadLocationData();
  }, [loadLocationData]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading location details...</div>;
  }

  if (!location) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h2>Location record not found</h2>
        <Link href="/locations" className="btn btn-primary" style={{ marginTop: "12px", display: "inline-flex" }}>
          <ArrowLeft size={16} />
          <span>Back to Locations</span>
        </Link>
      </div>
    );
  }

  const locationFullStr = [location.city, location.state, location.country].filter(Boolean).join(", ");

  const handleLinkTrip = async () => {
    if (!selectedTripToConnect) return;
    setConnectingTrip(true);
    await connectLocationToTrip(location.id, selectedTripToConnect);
    setSelectedTripToConnect("");
    setConnectingTrip(false);
    loadLocationData();
  };

  const handleUnlinkTrip = async (relId?: string) => {
    if (!relId) return;
    if (confirm("Disconnect this trip from this location?")) {
      await removeLocationTripConnection(relId, location.slug);
      loadLocationData();
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete location "${location.name}"?`)) {
      await deleteLocation(location.id);
      router.push("/locations");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Navigation & Actions Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/locations" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={14} />
          <span>Back to Locations</span>
        </Link>

        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 size={15} />
            <span>Edit Location</span>
          </button>
          <button className="btn btn-secondary" onClick={handleDelete} style={{ color: "#ef4444" }}>
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Hero Location Banner Card */}
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
              <MapPin size={24} style={{ color: "var(--accent)" }} />
              <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>{location.name}</h1>
              {location.favorite === 1 && <Star size={18} fill="#f59e0b" style={{ color: "#f59e0b" }} />}
            </div>

            {locationFullStr && (
              <div style={{ fontSize: "14px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <Globe size={16} style={{ color: "var(--text-muted)" }} />
                <span>{locationFullStr}</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            {location.visibility === "private" && <Lock size={12} />}
            {location.visibility === "unlisted" && <EyeOff size={12} />}
            <span style={{ textTransform: "capitalize" }}>{location.visibility}</span>
          </span>
        </div>

        {/* GPS, elevation & rating badges */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          {location.latitude && location.longitude && (
            <span style={{ fontFamily: "var(--font-mono)", backgroundColor: "var(--bg-hover)", padding: "2px 8px", borderRadius: "4px" }}>
              GPS: {location.latitude}, {location.longitude}
            </span>
          )}
          {location.elevation && (
            <span style={{ backgroundColor: "var(--bg-hover)", padding: "2px 8px", borderRadius: "4px" }}>
              Elevation: {location.elevation}m
            </span>
          )}
          {location.personalRating && (
            <span style={{ backgroundColor: "var(--bg-hover)", padding: "2px 8px", borderRadius: "4px", color: "#f59e0b", fontWeight: 600 }}>
              Rating: {location.personalRating} / 5
            </span>
          )}
        </div>

        {/* Photography & Camera Notes */}
        {(location.photographyNotes || location.cameraRecommendations) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
            {location.photographyNotes && (
              <div style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)", padding: "10px 12px", borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
                  <Camera size={14} /> Photography Notes
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap" }}>{location.photographyNotes}</p>
              </div>
            )}
            {location.cameraRecommendations && (
              <div style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)", padding: "10px 12px", borderRadius: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
                  <Camera size={14} /> Gear Recommendations
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-wrap" }}>{location.cameraRecommendations}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs Row */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: "16px" }}>
        <button
          onClick={() => setActiveTab("trips")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "trips" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "trips" ? "var(--accent)" : "var(--text-muted)",
            fontWeight: activeTab === "trips" ? 700 : 500,
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Compass size={16} />
          <span>Associated Trips ({entities?.associatedTrips.length || 0})</span>
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
          <span>People ({entities?.people.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: ASSOCIATED TRIPS */}
      {activeTab === "trips" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Link Trip bar */}
          <div style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Link Trip to Location:</span>
            <select className="form-input" value={selectedTripToConnect} onChange={(e) => setSelectedTripToConnect(e.target.value)} style={{ flex: 1 }}>
              <option value="">-- Select Trip --</option>
              {availableTrips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.title} ({tr.status})
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={handleLinkTrip} disabled={!selectedTripToConnect || connectingTrip}>
              <Plus size={14} />
              <span>Link Trip</span>
            </button>
          </div>

          {entities?.associatedTrips.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No trips associated with this location yet. Select a trip above to associate it.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {entities?.associatedTrips.map(({ relationshipId, trip }) => (
                <div key={trip.id} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Link href={`/trips/${trip.slug}`} style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", textDecoration: "none" }}>
                        {trip.title}
                      </Link>
                      <button onClick={() => handleUnlinkTrip(relationshipId)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                        <X size={14} />
                      </button>
                    </div>
                    {trip.description && <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>{trip.description}</p>}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                    <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "var(--accent)" }}>{trip.status}</span>
                    <Link href={`/trips/${trip.slug}`} style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
                      <span>View Trip</span> <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PHOTOS */}
      {activeTab === "photos" && (
        <div>
          {entities?.photos.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
              No gallery photos tagged with this location.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {entities?.photos.map((photo) => (
                <div key={photo.id} style={{ borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)", display: "flex", flexDirection: "column" }}>
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
              No microblog posts associated with this location.
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
              No movies registered for this location.
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
              No contacts connected to this location.
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

      {/* Location Edit Modal */}
      <LocationFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        locationToEdit={location}
        onSuccess={loadLocationData}
      />
    </div>
  );
}
