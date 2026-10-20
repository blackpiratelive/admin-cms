"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Sparkles,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import {
  collectionCountLabel,
  collectionKindLabel,
  collectionVisibilityLabel,
  formatCollectionDateTime,
  formatRelativeDate,
  formatViewCount,
  getCollectionPreviewPath,
} from "../collection-helpers";
import type { CollectionOverview } from "../collection-types";
import { CollectionCover } from "./CollectionCover";

interface FeaturedCollectionProps {
  collection: CollectionOverview;
}

export function FeaturedCollection({ collection }: FeaturedCollectionProps) {
  const [copied, setCopied] = useState(false);
  const detailHref = `/libraries/collections/${collection.slug}`;
  const previewPath = collection.sharePath
    ? getCollectionPreviewPath(collection.sharePath)
    : null;

  const copyLink = async () => {
    if (!collection.sharePath) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${collection.sharePath}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      notify.show({ type: "success", message: "Share link copied." });
    } catch {
      notify.show({ type: "error", message: "Could not copy the link." });
    }
  };

  return (
    <section
      className="collections-featured"
      aria-label={`Featured collection: ${collection.name}`}
      style={{ "--collection-color": collection.color || "var(--accent)" } as React.CSSProperties}
    >
      <Link
        href={detailHref}
        className="collections-featured-cover-link"
        aria-label={`Open featured collection ${collection.name}`}
      >
        <CollectionCover
          src={collection.coverUrl}
          color={collection.color}
          kind={collection.kind}
          alt=""
          eager
          className="collections-featured-cover"
        />
        <span className="collections-featured-shade" aria-hidden="true" />
      </Link>

      <div className="collections-featured-copy">
        <div className="collections-featured-eyebrow">
          <Sparkles size={14} /> Featured collection
        </div>
        <h2 className="collections-featured-title">
          <Link href={detailHref}>{collection.name}</Link>
        </h2>
        <div className="collections-featured-badges">
          <span className="collections-badge collections-kind">
            {collectionKindLabel(collection.kind)}
          </span>
          <span className={`collections-badge collections-visibility is-${collection.visibility}`}>
            {collectionVisibilityLabel(collection.visibility)}
          </span>
        </div>
        {collection.description ? (
          <p className="collections-featured-desc">{collection.description}</p>
        ) : (
          <p className="collections-featured-desc is-empty">
            A collection waiting for a description.
          </p>
        )}

        <div className="collections-featured-stats">
          <div>
            <strong>{collection.counts.total}</strong>
            <span>{collection.counts.total === 1 ? "item" : "items"}</span>
          </div>
          <div>
            <strong>{collection.counts.photos}</strong>
            <span>{collection.counts.photos === 1 ? "photo" : "photos"}</span>
          </div>
          <div>
            <strong>{formatViewCount(collection.analytics.viewCount)}</strong>
            <span>{collection.analytics.viewCount === 1 ? "view" : "views"}</span>
          </div>
        </div>

        <div className="collections-featured-meta">
          <span>{collectionCountLabel(collection)}</span>
          <span aria-hidden="true">·</span>
          <span title={formatCollectionDateTime(collection.updatedAt)}>
            Updated <span suppressHydrationWarning>{formatRelativeDate(collection.updatedAt)}</span>
          </span>
        </div>

        <div className="collections-featured-actions">
          <Link
            href={detailHref}
            className="collections-btn collections-btn-primary collections-btn-lg"
          >
            Open collection
          </Link>
          {collection.sharePath && (
            <>
              <button
                type="button"
                className="collections-btn collections-btn-ghost collections-btn-lg"
                onClick={copyLink}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied" : "Copy link"}
              </button>
              {previewPath && (
                <a
                  href={previewPath}
                  target="_blank"
                  rel="noreferrer"
                  className="collections-icon-btn collections-icon-btn-lg"
                  aria-label="Preview shared collection"
                  title="Preview shared collection"
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </>
          )}
          <span className="collections-featured-views">
            <Eye size={14} /> {formatViewCount(collection.analytics.viewCount)}
          </span>
        </div>
      </div>
    </section>
  );
}
