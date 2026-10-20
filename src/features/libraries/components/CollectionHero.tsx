"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Eye,
  ExternalLink,
  Share2,
} from "lucide-react";
import {
  collectionKindLabel,
  collectionVisibilityLabel,
  formatCollectionDateTime,
  formatRelativeDate,
  formatViewCount,
} from "../collection-helpers";
import type { CollectionDetail } from "../collection-types";
import { CollectionCover } from "./CollectionCover";

interface CollectionHeroProps {
  detail: CollectionDetail;
  previewPath: string | null;
  onChangeCover: () => void;
  onShare: () => void;
}

export function CollectionHero({
  detail,
  previewPath,
  onChangeCover,
  onShare,
}: CollectionHeroProps) {
  const { collection, counts, analytics } = detail;
  const films = counts.movies + counts.shows;
  const music = counts.artists + counts.albums + counts.tracks;

  return (
    <section
      className="collection-hero"
      style={{ "--collection-color": collection.color || "var(--accent)" } as React.CSSProperties}
    >
      <CollectionCover
        src={detail.coverUrl}
        color={collection.color}
        kind={collection.kind}
        alt=""
        eager
        className="collection-hero-cover"
      />
      <div className="collection-hero-shade" aria-hidden="true" />

      <div className="collection-hero-content">
        <Link href="/libraries/collections" className="collection-hero-back">
          <ArrowLeft size={14} /> All collections
        </Link>

        <div className="collection-hero-badges">
          <span className="collections-badge collections-kind">
            {collectionKindLabel(collection.kind)}
          </span>
          <span className={`collections-badge collections-visibility is-${collection.visibility}`}>
            {collectionVisibilityLabel(collection.visibility)}
          </span>
        </div>

        <h1 className="collection-hero-title">{collection.name}</h1>
        {collection.description ? (
          <p className="collection-hero-desc">{collection.description}</p>
        ) : (
          <p className="collection-hero-desc is-empty">
            Add a description in Settings to give this collection some context.
          </p>
        )}

        <div className="collection-hero-meta">
          <span><strong>{counts.total}</strong> {counts.total === 1 ? "item" : "items"}</span>
          <span><strong>{counts.photos}</strong> {counts.photos === 1 ? "photo" : "photos"}</span>
          <span><strong>{films}</strong> {films === 1 ? "film" : "films"}</span>
          <span><strong>{music}</strong> music</span>
          <span><strong>{counts.people}</strong> {counts.people === 1 ? "person" : "people"}</span>
          <span className="collection-hero-meta-divider" aria-hidden="true" />
          <span title={formatCollectionDateTime(collection.updatedAt)}>
            Updated <span suppressHydrationWarning>{formatRelativeDate(collection.updatedAt)}</span>
          </span>
          <span><Eye size={13} /> {formatViewCount(analytics.viewCount)} views</span>
        </div>

        <div className="collection-hero-actions">
          {previewPath && (
            <a
              href={previewPath}
              target="_blank"
              rel="noreferrer"
              className="collections-btn collections-btn-hero"
            >
              <ExternalLink size={15} /> Preview
            </a>
          )}
          <button
            type="button"
            className="collections-btn collections-btn-hero collections-btn-hero-primary"
            onClick={onShare}
          >
            <Share2 size={15} /> Share
          </button>
          <button
            type="button"
            className="collections-btn collections-btn-hero"
            onClick={onChangeCover}
          >
            <Camera size={15} /> Change cover
          </button>
        </div>
      </div>
    </section>
  );
}
