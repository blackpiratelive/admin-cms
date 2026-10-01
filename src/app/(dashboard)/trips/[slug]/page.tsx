"use client";

import React, { useState, useEffect, useCallback, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TripRecord, LocationRecord, Microblog, GalleryPhoto, PersonRecord } from "@/db/schema";
import {
  getTripHubDataAction,
  deleteTrip,
  connectTripToLocation,
  toggleTripFavoriteAction,
  TripAssociatedEntities,
  TripHubData,
} from "@/features/trips/actions";
import { removeLocationTripConnection } from "@/features/locations/actions";
import { TripFormModal } from "@/features/trips/components/TripFormModal";
import { TripItineraryTab } from "@/features/trips/components/TripItineraryTab";
import { TripMapTab } from "@/features/trips/components/TripMapTab";
import { TripStatusBadge } from "@/features/trips/components/TripStatusBadge";
import { DeleteTripDialog } from "@/features/trips/components/DeleteTripDialog";
import { EntityCombobox } from "@/components/EntityCombobox";
import { getLocationPickerData } from "@/features/pickers/actions";
import type { LocationPickerOption } from "@/features/pickers/types";
import {
  formatTripDateRange,
  computeTripDuration,
  formatTripDisplayTitle,
  getDeterministicCoverTheme,
} from "@/features/trips/trip-helpers";
import {
  ArrowLeft,
  CalendarDays,
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
  Navigation,
} from "lucide-react";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";
import { notify } from "@/lib/notifications";

type DetailTab = "itinerary" | "locations" | "map" | "photos" | "microblogs" | "movies" | "people";

export default function TripDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const slug = resolvedParams.slug;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [entities, setEntities] = useState<TripAssociatedEntities | null>(null);
  const [availableLocations, setAvailableLocations] = useState<LocationPickerOption[]>([]);
  const [recentLocIds, setRecentLocIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Selectors
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedLocToConnect, setSelectedLocToConnect] = useState("");
  const [connectingLoc, setConnectingLoc] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("itinerary");

  const loadTripData = useCallback(async () => {
    const cacheKey = `swr_trip_detail_${slug}`;
    const cached = getBrowserCache<TripHubData>(cacheKey);

    if (cached && cached.trip) {
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
      const data = await getLocationPickerData();
      setAvailableLocations(data.options);
      setRecentLocIds(data.recentIds);
    }
  };

  useEffect(() => {
    loadTripData();
  }, [loadTripData]);

  const duration = useMemo(() => {
    if (!trip) return 1;
    return computeTripDuration(trip.startDate, trip.endDate);
  }, [trip]);

  const dateRangeStr = useMemo(() => {
    if (!trip) return "";
    return formatTripDateRange(trip.startDate, trip.endDate);
  }, [trip]);

  const displayTitle = useMemo(() => {
    if (!trip) return "";
    return formatTripDisplayTitle(trip.title);
  }, [trip]);

  const fallbackTheme = useMemo(() => {
    if (!trip) return "one";
    return getDeterministicCoverTheme(trip.id || trip.slug);
  }, [trip]);

  // Favorite toggle action
  const handleToggleFavorite = async () => {
    if (!trip) return;
    const nextFavorite = trip.favorite !== 1;

    setTrip({ ...trip, favorite: nextFavorite ? 1 : 0 });

    notify.bg({
      title: nextFavorite ? "Added to Favorites" : "Removed from Favorites",
      loadingMessage: `Updating favorite...`,
      successMessage: nextFavorite ? `Added '${trip.title}' to favorites` : `Removed '${trip.title}' from favorites`,
      errorMessage: (err) => `Failed to update favorite: ${err?.message || String(err)}`,
      task: () => toggleTripFavoriteAction(trip.id, nextFavorite),
      onSuccess: () => loadTripData(),
    });
  };

  const handleLinkLocation = async () => {
    if (!selectedLocToConnect || !trip) return;
    setConnectingLoc(true);
    await connectTripToLocation(trip.id, selectedLocToConnect);
    setSelectedLocToConnect("");
    setConnectingLoc(false);
    loadTripData();
  };

  const handleUnlinkLocation = async (relId?: string) => {
    if (!relId || !trip) return;
    if (confirm("Disconnect this location from this trip?")) {
      await removeLocationTripConnection(relId, undefined, trip.slug);
      loadTripData();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!trip) return;
    setIsDeleting(true);
    try {
      await deleteTrip(trip.id);
      notify.show({ type: "success", message: `Trip "${trip.title}" deleted.` });
      router.push("/trips");
    } catch (err: any) {
      notify.show({ type: "error", message: `Failed to delete trip: ${err?.message || String(err)}` });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (loading && !trip) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted, #888)" }}>
        Loading trip details...
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="trip-empty-box" style={{ margin: "40px auto", maxWidth: "500px" }}>
        <strong className="trip-empty-title">Trip record not found</strong>
        <p className="trip-empty-desc">The requested trip could not be found or has been removed.</p>
        <Link href="/trips" className="trip-primary-btn" style={{ textDecoration: "none", display: "inline-flex" }}>
          <ArrowLeft size={16} />
          <span>Back to Trips</span>
        </Link>
      </div>
    );
  }

  // Cover image: first gallery photo or direct attachment
  const coverImgUrl = entities?.photos[0]?.mediumUrl || entities?.photos[0]?.thumbnailUrl;

  return (
    <div className="trip-hub" style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Top Breadcrumb Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link
          href="/trips"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: "var(--text-muted, #888)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Trips</span>
        </Link>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className="trip-ghost-btn"
            onClick={() => setIsEditModalOpen(true)}
            style={{ fontSize: "13px", padding: "8px 12px" }}
          >
            <Edit2 size={14} />
            <span>Edit Trip</span>
          </button>

          <button
            type="button"
            className="trip-ghost-btn"
            onClick={() => setIsDeleteDialogOpen(true)}
            style={{ fontSize: "13px", padding: "8px 12px", color: "#f87171" }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Hero Trip Banner */}
      <section
        style={{
          border: "1px solid var(--border-color, #343434)",
          borderRadius: "16px",
          overflow: "hidden",
          backgroundColor: "var(--bg-card, #1c1c1c)",
          boxShadow: "0 10px 32px rgba(0,0,0,0.2)",
        }}
        aria-label="Trip header"
      >
        <div
          className={`trip-cover ${!coverImgUrl ? `${fallbackTheme} has-art` : ""}`}
          style={{ height: "190px" }}
        >
          {coverImgUrl && (
            <img
              src={coverImgUrl}
              alt={`Cover for ${trip.title}`}
              className="trip-cover-img"
              loading="eager"
            />
          )}

          <div className="trip-cover-label">
            {duration} {duration === 1 ? "day" : "days"}
          </div>

          <button
            type="button"
            className={`trip-fav-btn ${trip.favorite === 1 ? "active" : ""}`}
            onClick={handleToggleFavorite}
            aria-label={trip.favorite === 1 ? "Favorited" : "Favorite"}
            title={trip.favorite === 1 ? "Favorited" : "Favorite"}
          >
            {trip.favorite === 1 ? "★" : "☆"}
          </button>
        </div>

        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                <TripStatusBadge status={trip.status} />

                {trip.visibility !== "public" && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted, #888)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      padding: "2px 7px",
                      borderRadius: "4px",
                    }}
                  >
                    {trip.visibility === "private" ? <Lock size={11} /> : <EyeOff size={11} />}
                    <span style={{ textTransform: "capitalize" }}>{trip.visibility}</span>
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px", color: "var(--text-primary, #fff)" }}>
                {displayTitle}
              </h1>

              <div style={{ fontSize: "14px", color: "var(--text-muted, #888)" }}>
                {dateRangeStr}
              </div>

              {trip.description && (
                <p style={{ fontSize: "14px", color: "var(--text-secondary, #bbb)", margin: "12px 0 0", lineHeight: 1.5, maxWidth: "720px" }}>
                  {trip.description}
                </p>
              )}
            </div>

            {/* Quick Stat Badges */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color, #333)", borderRadius: "8px", padding: "10px 14px", textAlign: "center" }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted, #777)", fontWeight: 700 }}>Days</span>
                <strong style={{ display: "block", fontSize: "17px", color: "#eee" }}>{duration}</strong>
              </div>

              <div style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color, #333)", borderRadius: "8px", padding: "10px 14px", textAlign: "center" }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted, #777)", fontWeight: 700 }}>Places</span>
                <strong style={{ display: "block", fontSize: "17px", color: "#eee" }}>{entities?.associatedLocations.length || 0}</strong>
              </div>

              <div style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color, #333)", borderRadius: "8px", padding: "10px 14px", textAlign: "center" }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-muted, #777)", fontWeight: 700 }}>Photos</span>
                <strong style={{ display: "block", fontSize: "17px", color: "#eee" }}>{entities?.photos.length || 0}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Switcher */}
      <nav
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-color, #343434)",
          gap: "8px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
        aria-label="Trip views"
      >
        <button
          type="button"
          onClick={() => setActiveTab("itinerary")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "itinerary" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "itinerary" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "itinerary" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <CalendarDays size={16} />
          <span>Itinerary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("locations")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "locations" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "locations" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "locations" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <MapPin size={16} />
          <span>Locations Visited ({entities?.associatedLocations.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("map")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "map" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "map" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "map" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <Navigation size={16} />
          <span>Map & Route</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("photos")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "photos" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "photos" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "photos" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <ImageIcon size={16} />
          <span>Photos ({entities?.photos.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("microblogs")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "microblogs" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "microblogs" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "microblogs" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <MessageSquareText size={16} />
          <span>Microblogs ({entities?.microblogs.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("movies")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "movies" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "movies" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "movies" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <Film size={16} />
          <span>Movies ({entities?.movies.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("people")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "people" ? "2px solid var(--accent, #ff6600)" : "2px solid transparent",
            color: activeTab === "people" ? "var(--accent, #ff6600)" : "var(--text-muted, #888)",
            fontWeight: activeTab === "people" ? 700 : 500,
            padding: "10px 14px",
            cursor: "pointer",
            fontSize: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          <Users size={16} />
          <span>People Joined ({entities?.people.length || 0})</span>
        </button>
      </nav>

      {/* TAB 0: ITINERARY */}
      {activeTab === "itinerary" && <TripItineraryTab trip={trip} />}

      {/* TAB 1: LOCATIONS VISITED */}
      {activeTab === "locations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Link Location Selector */}
          <div
            style={{
              backgroundColor: "var(--bg-card, #1c1c1c)",
              border: "1px solid var(--border-color, #333)",
              borderRadius: "10px",
              padding: "14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap" }}>
              Link Location to Trip:
            </span>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <EntityCombobox
                ariaLabel="Link Location"
                placeholder="Search location to link…"
                noneLabel="-- Select Location --"
                value={selectedLocToConnect || null}
                recentIds={recentLocIds}
                onOpen={loadAvailableLocations}
                onChange={(id) => setSelectedLocToConnect(id || "")}
                options={availableLocations.map((l) => ({
                  id: l.id,
                  label: l.name,
                  sublabel: [l.city, l.country].filter(Boolean).join(", ") || undefined,
                  favorite: l.favorite,
                }))}
              />
            </div>
            <button
              type="button"
              className="trip-primary-btn"
              onClick={handleLinkLocation}
              disabled={!selectedLocToConnect || connectingLoc}
              style={{ fontSize: "13px", padding: "8px 14px" }}
            >
              <Plus size={14} />
              <span>Link Location</span>
            </button>
          </div>

          {entities?.associatedLocations.length === 0 ? (
            <div className="trip-empty-box" style={{ padding: "30px" }}>
              <strong className="trip-empty-title">No locations linked yet</strong>
              <p className="trip-empty-desc">
                Select a location above to link it to this trip, or tag places in your itinerary days.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "14px",
              }}
            >
              {entities?.associatedLocations.map(({ relationshipId, location: loc }) => {
                const fullLocStr = [loc.city, loc.state, loc.country].filter(Boolean).join(", ");
                return (
                  <div
                    key={loc.id}
                    style={{
                      backgroundColor: "var(--bg-card, #1c1c1c)",
                      border: "1px solid var(--border-color, #333)",
                      borderRadius: "10px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Link
                          href={`/locations/${loc.slug}`}
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "var(--text-primary, #fff)",
                            textDecoration: "none",
                          }}
                        >
                          {loc.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleUnlinkLocation(relationshipId)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                          title="Unlink location"
                          aria-label={`Unlink ${loc.name}`}
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {fullLocStr && (
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--text-secondary, #aaa)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "4px",
                          }}
                        >
                          <Globe size={13} style={{ color: "var(--text-muted, #777)" }} />
                          <span>{fullLocStr}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color, #2a2a2a)", paddingTop: "8px" }}>
                      <Link
                        href={`/locations/${loc.slug}`}
                        style={{
                          fontSize: "12px",
                          color: "var(--accent, #ff6600)",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                          fontWeight: 600,
                        }}
                      >
                        <span>View Location</span>
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MAP & ROUTE */}
      {activeTab === "map" && <TripMapTab tripSlugOrId={trip.slug} />}

      {/* TAB 3: PHOTOS */}
      {activeTab === "photos" && (
        <div>
          {entities?.photos.length === 0 ? (
            <div className="trip-empty-box" style={{ padding: "30px" }}>
              <strong className="trip-empty-title">No photos recorded</strong>
              <p className="trip-empty-desc">No gallery photos or media have been linked to this trip yet.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {entities?.photos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "1px solid var(--border-color, #333)",
                    backgroundColor: "var(--bg-card, #1c1c1c)",
                  }}
                >
                  <img
                    src={photo.thumbnailUrl || photo.mediumUrl}
                    alt={photo.title}
                    style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }}
                    loading="lazy"
                  />
                  <div style={{ padding: "8px 10px", fontSize: "12px", fontWeight: 600 }}>{photo.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MICROBLOGS */}
      {activeTab === "microblogs" && (
        <div>
          {entities?.microblogs.length === 0 ? (
            <div className="trip-empty-box" style={{ padding: "30px" }}>
              <strong className="trip-empty-title">No microblogs recorded</strong>
              <p className="trip-empty-desc">No microblog updates have been tagged with this trip.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {entities?.microblogs.map((mb) => (
                <div
                  key={mb.id}
                  style={{
                    backgroundColor: "var(--bg-card, #1c1c1c)",
                    border: "1px solid var(--border-color, #333)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <div style={{ fontSize: "14px", whiteSpace: "pre-wrap", color: "var(--text-primary, #ddd)" }}>
                    {mb.contentMarkdown}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #777)", marginTop: "8px" }}>
                    Posted: {mb.publishedAt || mb.createdAt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MOVIES */}
      {activeTab === "movies" && (
        <div>
          {entities?.movies.length === 0 ? (
            <div className="trip-empty-box" style={{ padding: "30px" }}>
              <strong className="trip-empty-title">No movies recorded</strong>
              <p className="trip-empty-desc">No movies have been associated with this trip.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
              {entities?.movies.map((m) => (
                <div
                  key={m.traktId}
                  style={{
                    backgroundColor: "var(--bg-card, #1c1c1c)",
                    border: "1px solid var(--border-color, #333)",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    gap: "10px",
                  }}
                >
                  {m.posterPath && (
                    <img
                      src={`https://image.tmdb.org/t/p/w185${m.posterPath}`}
                      alt={m.title}
                      style={{ width: "48px", borderRadius: "4px", objectFit: "cover" }}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>{m.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #888)" }}>{m.year}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: PEOPLE */}
      {activeTab === "people" && (
        <div>
          {entities?.people.length === 0 ? (
            <div className="trip-empty-box" style={{ padding: "30px" }}>
              <strong className="trip-empty-title">No contacts linked</strong>
              <p className="trip-empty-desc">No friends or travel companions have been connected to this trip.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
              {entities?.people.map(({ person }) => (
                <Link
                  key={person.id}
                  href={`/people/${person.slug}`}
                  style={{
                    backgroundColor: "var(--bg-card, #1c1c1c)",
                    border: "1px solid var(--border-color, #333)",
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={person.displayName}
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        backgroundColor: "var(--accent, #ff6600)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                      }}
                    >
                      {person.displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{person.displayName}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted, #888)" }}>{person.relationshipType}</div>
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

      {/* Delete Confirmation Dialog */}
      <DeleteTripDialog
        isOpen={isDeleteDialogOpen}
        tripTitle={trip.title}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteDialogOpen(false)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
