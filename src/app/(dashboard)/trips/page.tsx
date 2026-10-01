"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus } from "lucide-react";
import {
  getTripsOverviewAction,
  deleteTrip,
  duplicateTripAction,
  toggleTripFavoriteAction,
} from "@/features/trips/actions";
import type {
  TripOverviewItem,
  TripFilterType,
  TripSortType,
  TripViewMode,
} from "@/features/trips/types";
import {
  filterAndSortTrips,
  selectFeaturedTrip,
} from "@/features/trips/trip-helpers";
import { TripsToolbar } from "@/features/trips/components/TripsToolbar";
import { TripFilterChips } from "@/features/trips/components/TripFilterChips";
import { FeaturedTrip } from "@/features/trips/components/FeaturedTrip";
import { TripCard } from "@/features/trips/components/TripCard";
import { TripEmptyState } from "@/features/trips/components/TripEmptyState";
import { TripCardSkeleton, FeaturedTripSkeleton } from "@/features/trips/components/TripSkeleton";
import { TripFormModal } from "@/features/trips/components/TripFormModal";
import { DeleteTripDialog } from "@/features/trips/components/DeleteTripDialog";
import { getBrowserCache, setBrowserCache } from "@/lib/client-cache";
import { notify } from "@/lib/notifications";

const CACHE_KEY = "swr_trips_overview_list";

export default function TripsPage() {
  const [allTrips, setAllTrips] = useState<TripOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search, sort, view and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TripFilterType>("all");
  const [sortValue, setSortValue] = useState<TripSortType>("recent");
  const [viewMode, setViewMode] = useState<TripViewMode>("grid");

  // Modals & Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tripToEdit, setTripToEdit] = useState<TripOverviewItem | null>(null);
  const [tripToDelete, setTripToDelete] = useState<TripOverviewItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    const cached = getBrowserCache<TripOverviewItem[]>(CACHE_KEY);
    if (cached && cached.length > 0) {
      setAllTrips(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const data = await getTripsOverviewAction();
      setAllTrips(data);
      setBrowserCache(CACHE_KEY, data);
    } catch (err) {
      console.error("Failed to load trips:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute filter counts
  const filterCounts = useMemo(() => {
    const counts: Partial<Record<TripFilterType, number>> = {
      all: allTrips.length,
      upcoming: 0,
      ongoing: 0,
      completed: 0,
      favorites: 0,
    };

    for (const t of allTrips) {
      if (t.favorite) counts.favorites = (counts.favorites || 0) + 1;
      if (t.status === "completed") counts.completed = (counts.completed || 0) + 1;
      if (t.status === "ongoing") counts.ongoing = (counts.ongoing || 0) + 1;
      if (t.status === "planned") counts.upcoming = (counts.upcoming || 0) + 1;
    }
    return counts;
  }, [allTrips]);

  // Filtered & sorted trips
  const filteredTrips = useMemo(() => {
    return filterAndSortTrips(allTrips, searchQuery, activeFilter, sortValue);
  }, [allTrips, searchQuery, activeFilter, sortValue]);

  // Featured trip selection (deterministic priority rule)
  const featuredTrip = useMemo(() => {
    // Only show featured trip in "all" or "favorites" filter without active search
    if (searchQuery.trim()) return null;
    if (activeFilter !== "all" && activeFilter !== "favorites" && activeFilter !== "completed") return null;
    return selectFeaturedTrip(allTrips);
  }, [allTrips, searchQuery, activeFilter]);

  // Favorite toggle action (optimistic update with rollback)
  const handleToggleFavorite = async (tripId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = allTrips.find((t) => t.id === tripId);
    if (!target) return;

    const nextState = !target.favorite;

    // Optimistic UI update
    setAllTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, favorite: nextState } : t))
    );

    notify.bg({
      title: nextState ? "Added to Favorites" : "Removed from Favorites",
      loadingMessage: `Updating favorite for '${target.title}'...`,
      successMessage: nextState ? `Added '${target.title}' to favorites` : `Removed '${target.title}' from favorites`,
      errorMessage: (err) => `Failed to update favorite: ${err?.message || String(err)}`,
      task: () => toggleTripFavoriteAction(tripId, nextState),
      onSuccess: () => {
        loadData();
      },
    });
  };

  // Duplicate trip action
  const handleDuplicate = async (tripId: string) => {
    const target = allTrips.find((t) => t.id === tripId);
    const title = target ? target.title : "trip";

    notify.bg({
      title: "Duplicate Trip",
      loadingMessage: `Duplicating '${title}'...`,
      successMessage: `Duplicated '${title}' successfully!`,
      errorMessage: (err) => `Failed to duplicate trip: ${err?.message || String(err)}`,
      task: () => duplicateTripAction(tripId),
      onSuccess: () => {
        loadData();
      },
    });
  };

  // Delete trip confirmation
  const handleConfirmDelete = async () => {
    if (!tripToDelete) return;
    setIsDeleting(true);
    const title = tripToDelete.title;

    try {
      await deleteTrip(tripToDelete.id);
      setTripToDelete(null);
      notify.show({ type: "success", message: `Trip '${title}' deleted.` });
      loadData();
    } catch (err: any) {
      notify.show({ type: "error", message: `Failed to delete trip: ${err?.message || String(err)}` });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="trip-hub">
      {/* 5A. Topbar / Header */}
      <header className="trip-topbar">
        <div>
          <div className="trip-brandline">
            <div className="trip-brand-icon" aria-hidden="true">
              ↗
            </div>
            <h1 className="trip-title">Trips</h1>
          </div>
          <p className="trip-sub">
            Your itineraries, places, photos, and memories — in one timeline.
          </p>
        </div>

        <button
          type="button"
          className="trip-primary-btn"
          onClick={() => {
            setTripToEdit(null);
            setIsFormOpen(true);
          }}
        >
          <Plus size={16} />
          <span>New Trip</span>
        </button>
      </header>

      {/* 6. Search / Sort / View Toolbar */}
      <TripsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortValue={sortValue}
        onSortChange={setSortValue}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 7. Filter Chips */}
      <TripFilterChips
        activeFilter={activeFilter}
        onChangeFilter={setActiveFilter}
        counts={filterCounts}
      />

      {/* 8. Featured Trip */}
      {loading && !featuredTrip && <FeaturedTripSkeleton />}
      {!loading && featuredTrip && (
        <FeaturedTrip
          trip={featuredTrip}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* Section Header */}
      <div className="trip-section-head">
        <div>
          <h2 className="trip-section-title">All trips</h2>
          <div className="trip-count-badge">
            {filteredTrips.length} {filteredTrips.length === 1 ? "trip" : "trips"}
          </div>
        </div>
      </div>

      {/* Main Trip Collection */}
      {loading && allTrips.length === 0 ? (
        <main className={`trip-grid ${viewMode === "list" ? "list" : ""}`}>
          <TripCardSkeleton count={6} />
        </main>
      ) : filteredTrips.length === 0 ? (
        <TripEmptyState
          isFiltered={Boolean(searchQuery || activeFilter !== "all")}
          onClearFilters={() => {
            setSearchQuery("");
            setActiveFilter("all");
          }}
          onCreateTrip={() => {
            setTripToEdit(null);
            setIsFormOpen(true);
          }}
        />
      ) : (
        <main
          className={`trip-grid ${viewMode === "list" ? "list" : ""}`}
          id="trips-collection-grid"
        >
          {filteredTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              viewMode={viewMode}
              onToggleFavorite={handleToggleFavorite}
              onEdit={(t) => {
                setTripToEdit(t);
                setIsFormOpen(true);
              }}
              onDuplicate={handleDuplicate}
              onDelete={(t) => setTripToDelete(t)}
            />
          ))}
        </main>
      )}

      {/* Form Modal (Create / Edit) */}
      <TripFormModal
        isOpen={isFormOpen}
        tripToEdit={
          tripToEdit
            ? allTrips.find((t) => t.id === tripToEdit.id)
              ? {
                  id: tripToEdit.id,
                  title: tripToEdit.title,
                  slug: tripToEdit.slug,
                  description: tripToEdit.description,
                  startDate: tripToEdit.startDate,
                  endDate: tripToEdit.endDate,
                  status: tripToEdit.status,
                  visibility: tripToEdit.visibility,
                  favorite: tripToEdit.favorite ? 1 : 0,
                  tags: JSON.stringify(tripToEdit.tags),
                  createdAt: tripToEdit.createdAt,
                  updatedAt: tripToEdit.updatedAt,
                }
              : null
            : null
        }
        onClose={() => {
          setIsFormOpen(false);
          setTripToEdit(null);
        }}
        onSuccess={loadData}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTripDialog
        isOpen={tripToDelete !== null}
        tripTitle={tripToDelete?.title || ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTripToDelete(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
