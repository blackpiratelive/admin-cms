"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocationRecord, TripRecord, Microblog, GalleryPhoto, PersonRecord } from "@/db/schema";
import {
  getLocationHubDataAction,
  deleteLocation,
  connectLocationToTrip,
  removeLocationTripConnection,
  connectLocationToPersonAction,
  removeLocationPersonConnectionAction,
  connectLocationPhotosBatchAction,
  removeLocationPhotoConnectionAction,
  LocationAssociatedEntities,
  LocationHubData,
  LocationPhotoItem,
} from "@/features/locations/actions";
import { getTrips } from "@/features/trips/actions";
import { getPeopleAction } from "@/features/people/actions";
import { LocationFormModal } from "@/features/locations/components/LocationFormModal";
import { GeocodeLocationModal } from "@/features/locations/components/GeocodeLocationModal";
import { PhotoPickerModal } from "@/components/PhotoPickerModal";
import {
  ArrowLeft,
  MapPin,
  Globe,
  Camera,
  Star,
  Edit2,
  Trash2,
  Compass,
  Search,
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
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";

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
  const [isGeocodeModalOpen, setIsGeocodeModalOpen] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [selectedTripToConnect, setSelectedTripToConnect] = useState("");
  const [connectingTrip, setConnectingTrip] = useState(false);

  // People linking state
  const [availablePeople, setAvailablePeople] = useState<PersonRecord[]>([]);
  const [selectedPersonToConnect, setSelectedPersonToConnect] = useState("");
  const [personRoleVerb, setPersonRoleVerb] = useState("visited");
  const [connectingPerson, setConnectingPerson] = useState(false);

  const [activeTab, setActiveTab] = useState<"trips" | "photos" | "microblogs" | "movies" | "people">("trips");

  const loadLocationData = useCallback(async () => {
    const cacheKey = `swr_location_detail_${slug}`;
    const cached = getBrowserCache<LocationHubData>(cacheKey);

    if (cached) {
      setLocation(cached.location);
      setEntities(cached.entities);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await getLocationHubDataAction(slug);
      if (data && data.location) {
        setLocation(data.location);
        setEntities(data.entities);
        setBrowserCache(cacheKey, data);
      }
    } catch (err) {
      console.error("Error loading location details:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const loadAvailableTrips = async () => {
    if (availableTrips.length === 0) {
      const trps = await getTrips();
      setAvailableTrips(trps);
    }
  };

  const loadAvailablePeople = async () => {
    if (availablePeople.length === 0) {
      const peopleList = await getPeopleAction();
      setAvailablePeople(peopleList);
    }
  };

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

  const handleLinkPerson = async () => {
    if (!selectedPersonToConnect || !location) return;
    setConnectingPerson(true);
    await connectLocationToPersonAction(location.id, selectedPersonToConnect, personRoleVerb);
    setSelectedPersonToConnect("");
    setConnectingPerson(false);
    loadLocationData();
  };

  const handleUnlinkPerson = async (relId?: string, personName?: string) => {
    if (!relId || !location) return;
    if (confirm(`Disconnect ${personName || "this person"} from this location?`)) {
      await removeLocationPersonConnectionAction(relId, location.slug);
      loadLocationData();
    }
  };

  const handleUnlinkPhoto = async (photoIdOrRelId: string) => {
    if (!location) return;
    if (confirm("Disconnect/remove this photo from this location?")) {
      await removeLocationPhotoConnectionAction(photoIdOrRelId, location.id, location.slug);
      loadLocationData();
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete location "${location.name}"?`)) {
      await deleteLocation(location.id);
      router.push("/locations");
    }
  };

  const hasGps =
    location.latitude !== null &&
    location.latitude !== undefined &&
    location.longitude !== null &&
    location.longitude !== undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Navigation & Actions Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/locations" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}>
          <ArrowLeft size={14} />
          <span>Back to Locations</span>
        </Link>

        <div style={{ display: "flex", gap: "8px" }}>
          {!hasGps && (
            <button
              className="btn btn-secondary"
              onClick={() => setIsGeocodeModalOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--accent)", borderColor: "var(--accent)" }}
            >
              <Compass size={15} />
              <span>Find Coordinates</span>
            </button>
          )}
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
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          {hasGps ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontFamily: "var(--font-mono)", backgroundColor: "var(--bg-hover)", padding: "2px 8px", borderRadius: "4px" }}>
                GPS: {location.latitude}, {location.longitude}
              </span>
              <button
                onClick={() => setIsGeocodeModalOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "2px 4px",
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "11px",
                  gap: "2px",
                }}
                title="Update GPS coordinates via Mapbox"
              >
                <Edit2 size={11} />
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                padding: "4px 10px",
                borderRadius: "6px",
                color: "var(--text-primary)",
              }}
            >
              <Compass size={14} style={{ color: "#f59e0b" }} />
              <span style={{ fontSize: "12px", fontWeight: 500 }}>No coordinates saved</span>
              <button
                className="btn btn-secondary"
                onClick={() => setIsGeocodeModalOpen(true)}
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  borderColor: "#f59e0b",
                  color: "#f59e0b",
                  backgroundColor: "var(--bg-card)",
                }}
              >
                <Search size={11} />
                <span>Search with Mapbox</span>
              </button>
            </div>
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
            <select className="form-input" value={selectedTripToConnect} onFocus={loadAvailableTrips} onChange={(e) => setSelectedTripToConnect(e.target.value)} style={{ flex: 1 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Photos Header Action Bar */}
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>Location Media & Photos</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>
                ({entities?.photos.length || 0} total
                {(entities?.photos.filter((p) => !!p.sourceTrip).length || 0) > 0
                  ? ` · ${entities?.photos.filter((p) => !!p.sourceTrip).length} from associated trip${
                      (entities?.photos.filter((p) => !!p.sourceTrip).length || 0) === 1 ? "" : "s"
                    }`
                  : ""}
                )
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => setIsPhotoPickerOpen(true)}>
              <Plus size={14} />
              <span>Add Photos</span>
            </button>
          </div>

          {entities?.photos.length === 0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
              }}
            >
              No photos added to this location yet. Click &quot;Add Photos&quot; above to choose from gallery, Cloudinary, or upload new files.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "14px",
              }}
            >
              {entities?.photos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-card)",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "4/3",
                      backgroundColor: "var(--bg-hover)",
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.mediumUrl || photo.originalUrl}
                      alt={photo.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                    {photo.sourceTrip && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          left: "6px",
                          right: "6px",
                          zIndex: 2,
                        }}
                      >
                        <Link
                          href={`/trips/${photo.sourceTrip.slug}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: "rgba(0, 0, 0, 0.75)",
                            color: "#fff",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            backdropFilter: "blur(4px)",
                            textDecoration: "none",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={`Trip: ${photo.sourceTrip.title}`}
                        >
                          <Compass size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            from this trip: {photo.sourceTrip.title}
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        fontWeight: 600,
                        flex: 1,
                      }}
                      title={photo.title}
                    >
                      {photo.title}
                    </div>
                    {!photo.sourceTrip && (
                      <button
                        onClick={() => handleUnlinkPhoto(photo.relationshipId || photo.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: "2px",
                          borderRadius: "4px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="Remove photo from location"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Link Person Bar */}
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Link Person to Location:</span>
            <select
              className="form-input"
              value={selectedPersonToConnect}
              onFocus={loadAvailablePeople}
              onChange={(e) => setSelectedPersonToConnect(e.target.value)}
              style={{ flex: 1, minWidth: "180px" }}
            >
              <option value="">-- Select Person --</option>
              {availablePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} {p.relationshipType ? `(${p.relationshipType})` : ""}
                </option>
              ))}
            </select>
            <select
              className="form-input"
              value={personRoleVerb}
              onChange={(e) => setPersonRoleVerb(e.target.value)}
              style={{ width: "140px" }}
            >
              <option value="visited">Visited</option>
              <option value="accompanied">Accompanied</option>
              <option value="lived_at">Lived At</option>
              <option value="local_guide">Local Guide</option>
              <option value="met_at">Met At</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={handleLinkPerson}
              disabled={!selectedPersonToConnect || connectingPerson}
            >
              <Plus size={14} />
              <span>Link Person</span>
            </button>
          </div>

          {entities?.people.length === 0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "var(--text-muted)",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
              }}
            >
              No contacts connected to this location yet. Select a person above to link them.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {entities?.people.map(({ relationshipId, person }) => (
                <div
                  key={person.id}
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <Link
                    href={`/people/${person.slug}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      textDecoration: "none",
                      color: "inherit",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {person.avatarUrl ? (
                      <img
                        src={person.avatarUrl}
                        alt={person.displayName}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          backgroundColor: "var(--accent)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {person.displayName.charAt(0)}
                      </div>
                    )}
                    <div style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {person.displayName}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {person.relationshipType || "Contact"}
                      </div>
                    </div>
                  </Link>

                  {relationshipId && (
                    <button
                      onClick={() => handleUnlinkPerson(relationshipId, person.displayName)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title="Disconnect person from location"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
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

      {/* Geocode Coordinates Modal */}
      <GeocodeLocationModal
        isOpen={isGeocodeModalOpen}
        onClose={() => setIsGeocodeModalOpen(false)}
        location={location}
        onSuccess={(updated) => {
          setLocation(updated);
          loadLocationData();
        }}
      />

      {/* 3-Tab Photo Picker Modal */}
      <PhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        entityName={location.name}
        entityType="location"
        entityId={location.id}
        defaultVerb="taken_at"
        title={`Add Photos to ${location.name}`}
        subtitle="Choose existing gallery photos, pick from Cloudinary, or upload new files"
        onConnectPhotos={(photos, verb) =>
          connectLocationPhotosBatchAction(location.id, photos, verb)
        }
        onSuccess={loadLocationData}
      />
    </div>
  );
}
