"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Layers,
  Lock,
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
  type CollectionViewMode,
} from "../collection-helpers";
import type { CollectionOverview } from "../collection-types";
import { CollectionCover } from "./CollectionCover";

interface CollectionCardProps {
  collection: CollectionOverview;
  viewMode: CollectionViewMode;
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility === "public") return <Globe size={12} />;
  if (visibility === "unlisted") return <EyeOff size={12} />;
  return <Lock size={12} />;
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  return (
    <span className={`collections-badge collections-visibility is-${visibility}`}>
      <VisibilityIcon visibility={visibility} />
      {collectionVisibilityLabel(visibility)}
    </span>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="collections-badge collections-kind">
      {kind === "mixed" ? <Layers size={12} /> : null}
      {collectionKindLabel(kind)}
    </span>
  );
}

export function CollectionCard({ collection, viewMode }: CollectionCardProps) {
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

  const badges = (
    <>
      <KindBadge kind={collection.kind} />
      <VisibilityBadge visibility={collection.visibility} />
    </>
  );

  const actions = (
    <div className="collections-card-actions">
      <Link href={detailHref} className="collections-btn collections-btn-primary collections-btn-sm">
        Open
      </Link>
      {collection.sharePath && (
        <>
          <button
            type="button"
            className="collections-icon-btn"
            onClick={copyLink}
            aria-label={copied ? "Share link copied" : "Copy share link"}
            title={copied ? "Copied" : "Copy share link"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {previewPath && (
            <a
              href={previewPath}
              target="_blank"
              rel="noreferrer"
              className="collections-icon-btn"
              aria-label="Preview shared collection"
              title="Preview shared collection"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </>
      )}
    </div>
  );

  if (viewMode === "list") {
    return (
      <article className="collections-row">
        <Link
          href={detailHref}
          className="collections-row-cover"
          aria-label={`Open ${collection.name}`}
        >
          <CollectionCover
            src={collection.coverUrl}
            color={collection.color}
            kind={collection.kind}
            alt=""
          />
        </Link>

        <div className="collections-row-body">
          <div className="collections-row-badges">{badges}</div>
          <Link href={detailHref} className="collections-row-title">
            {collection.name}
          </Link>
          {collection.description && (
            <p className="collections-row-desc">{collection.description}</p>
          )}
          <div className="collections-row-meta">
            <span>{collectionCountLabel(collection)}</span>
            <span aria-hidden="true">·</span>
            <span title={formatCollectionDateTime(collection.updatedAt)}>
              Updated <span suppressHydrationWarning>{formatRelativeDate(collection.updatedAt)}</span>
            </span>
          </div>
        </div>

        <div className="collections-row-side">
          <span className="collections-views" title={`${collection.analytics.viewCount} views`}>
            <Eye size={14} /> {formatViewCount(collection.analytics.viewCount)}
          </span>
          {actions}
        </div>
      </article>
    );
  }

  return (
    <article className="collections-card">
      <Link
        href={detailHref}
        className="collections-card-cover-link"
        aria-label={`Open ${collection.name}`}
      >
        <CollectionCover
          src={collection.coverUrl}
          color={collection.color}
          kind={collection.kind}
          alt=""
        />
        <span className="collections-cover-shade" aria-hidden="true" />
      </Link>

      <div className="collections-card-body">
        <div className="collections-card-badges">{badges}</div>
        <Link href={detailHref} className="collections-card-title">
          {collection.name}
        </Link>
        {collection.description ? (
          <p className="collections-card-desc">{collection.description}</p>
        ) : (
          <p className="collections-card-desc is-empty">No description yet</p>
        )}
        <div className="collections-card-counts">{collectionCountLabel(collection)}</div>

        <footer className="collections-card-footer">
          <div className="collections-card-meta">
            <span title={formatCollectionDateTime(collection.updatedAt)}>
              <span suppressHydrationWarning>{formatRelativeDate(collection.updatedAt)}</span>
            </span>
            <span className="collections-views" title={`${collection.analytics.viewCount} views`}>
              <Eye size={13} /> {formatViewCount(collection.analytics.viewCount)}
            </span>
          </div>
          {actions}
        </footer>
      </div>
    </article>
  );
}
