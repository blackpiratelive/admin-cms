"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EyeOff,
  FolderOpen,
  Globe,
  Layers,
  Lock,
  Plus,
} from "lucide-react";
import {
  filterAndSortCollections,
  selectFeaturedCollection,
  type CollectionKindFilter,
  type CollectionSort,
  type CollectionVisibilityFilter,
  type CollectionViewMode,
} from "../collection-helpers";
import type { CollectionOverview } from "../collection-types";
import { CollectionCard } from "./CollectionCard";
import { CollectionCreateModal } from "./CollectionCreateModal";
import { CollectionsToolbar } from "./CollectionsToolbar";
import { FeaturedCollection } from "./FeaturedCollection";

interface CollectionsManagerProps {
  collections: CollectionOverview[];
}

const VIEW_MODE_KEY = "collections-view-mode";

export function CollectionsManager({ collections }: CollectionsManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CollectionKindFilter>("all");
  const [visibility, setVisibility] = useState<CollectionVisibilityFilter>("all");
  const [sort, setSort] = useState<CollectionSort>("updated");
  const [viewMode, setViewMode] = useState<CollectionViewMode>("grid");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "grid" || stored === "list") setViewMode(stored);
    } catch {
      // localStorage may be unavailable in private browsing modes.
    }
  }, []);

  const changeViewMode = (mode: CollectionViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  };

  const stats = useMemo(() => {
    const result = {
      total: collections.length,
      public: 0,
      unlisted: 0,
      private: 0,
      items: 0,
    };
    for (const collection of collections) {
      if (collection.visibility === "public") result.public += 1;
      else if (collection.visibility === "unlisted") result.unlisted += 1;
      else result.private += 1;
      result.items += collection.counts.total;
    }
    return result;
  }, [collections]);

  const filtered = useMemo(
    () => filterAndSortCollections(collections, { query, kind, visibility, sort }),
    [collections, kind, query, sort, visibility]
  );

  const filtersActive = Boolean(query.trim()) || kind !== "all" || visibility !== "all";
  const featured = !filtersActive && collections.length >= 2
    ? selectFeaturedCollection(collections)
    : null;
  const visibleCollections = featured
    ? filtered.filter((collection) => collection.id !== featured.id)
    : filtered;

  const clearFilters = () => {
    setQuery("");
    setKind("all");
    setVisibility("all");
  };

  const statCards = [
    { label: "Collections", value: stats.total, icon: <Layers size={16} />, tone: "accent" },
    { label: "Public", value: stats.public, icon: <Globe size={16} />, tone: "public" },
    { label: "Unlisted", value: stats.unlisted, icon: <EyeOff size={16} />, tone: "unlisted" },
    { label: "Private", value: stats.private, icon: <Lock size={16} />, tone: "private" },
    { label: "Items", value: stats.items, icon: <FolderOpen size={16} />, tone: "neutral" },
  ];

  return (
    <div className="collections-hub">
      <header className="collections-header">
        <div className="collections-header-copy">
          <div className="collections-eyebrow">
            <FolderOpen size={14} /> Library
          </div>
          <h1 className="collections-title">Collections</h1>
          <p className="collections-subtitle">
            Build photo albums or curated media collections, then share them as a
            private, unlisted, or public link.
          </p>
        </div>
        <button
          type="button"
          className="collections-btn collections-btn-primary collections-btn-lg"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={17} /> New collection
        </button>
      </header>

      {collections.length > 0 && (
        <div className="collections-stats" aria-label="Collection totals">
          {statCards.map((stat) => (
            <div key={stat.label} className={`collections-stat is-${stat.tone}`}>
              <span className="collections-stat-icon">{stat.icon}</span>
              <span className="collections-stat-value">{stat.value}</span>
              <span className="collections-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {collections.length === 0 ? (
        <section className="collections-empty">
          <span className="collections-empty-icon">
            <FolderOpen size={30} />
          </span>
          <div>
            <h2>Your first collection starts here</h2>
            <p>
              Gather a set of photos, films, music, or people into a page you can
              share with a link.
            </p>
          </div>
          <button
            type="button"
            className="collections-btn collections-btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} /> Create a collection
          </button>
        </section>
      ) : (
        <>
          {featured && <FeaturedCollection collection={featured} />}

          <CollectionsToolbar
            collections={collections}
            query={query}
            kind={kind}
            visibility={visibility}
            sort={sort}
            viewMode={viewMode}
            onQueryChange={setQuery}
            onKindChange={setKind}
            onVisibilityChange={setVisibility}
            onSortChange={setSort}
            onViewModeChange={changeViewMode}
          />

          <div className="collections-section-head">
            <div>
              <h2>
                {filtersActive
                  ? "Filtered collections"
                  : featured
                    ? "More collections"
                    : "All collections"}
              </h2>
              <p>
                {featured
                  ? `${visibleCollections.length} more ${
                      visibleCollections.length === 1 ? "collection" : "collections"
                    }`
                  : `${filtered.length} of ${collections.length}${
                      filtersActive ? " collections match" : " collections"
                    }`}
              </p>
            </div>
            {filtersActive && (
              <button
                type="button"
                className="collections-btn collections-btn-ghost collections-btn-sm"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>

          {visibleCollections.length === 0 ? (
            <section className="collections-empty collections-empty-compact">
              <span className="collections-empty-icon">
                <FolderOpen size={26} />
              </span>
              <div>
                <h2>No collections match</h2>
                <p>Try a different search, type, or visibility filter.</p>
              </div>
              <button
                type="button"
                className="collections-btn collections-btn-ghost"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </section>
          ) : (
            <div
              className={
                viewMode === "grid" ? "collections-grid" : "collections-list"
              }
            >
              {visibleCollections.map((collection) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CollectionCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(slug) => {
          router.push(`/libraries/collections/${slug}?tab=content`);
          router.refresh();
        }}
      />
    </div>
  );
}
