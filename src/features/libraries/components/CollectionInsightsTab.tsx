"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Eye,
  Film,
  Globe,
  Image as ImageIcon,
  Lock,
  Music,
  Share2,
  Tv,
  User,
} from "lucide-react";
import {
  formatRelativeDate,
  formatViewCount,
} from "../collection-helpers";
import type { CollectionDetail } from "../collection-types";

interface CollectionInsightsTabProps {
  detail: CollectionDetail;
}

function utcDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function CollectionInsightsTab({ detail }: CollectionInsightsTabProps) {
  const [now, setNow] = useState<number | null>(null);
  const { analytics, counts, collection } = detail;

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const daysLive = now
    ? Math.max(
        1,
        Math.ceil((now - new Date(collection.createdAt).getTime()) / 86_400_000)
      )
    : null;
  const viewsPerDay =
    daysLive && analytics.viewCount > 0 ? analytics.viewCount / daysLive : 0;

  const mix = [
    { label: "Photos", count: counts.photos, icon: <ImageIcon size={14} /> },
    { label: "Films", count: counts.movies, icon: <Film size={14} /> },
    { label: "TV", count: counts.shows, icon: <Tv size={14} /> },
    {
      label: "Music",
      count: counts.artists + counts.albums + counts.tracks,
      icon: <Music size={14} />,
    },
    { label: "People", count: counts.people, icon: <User size={14} /> },
  ].filter((entry) => entry.count > 0);

  const visibilityLabel =
    collection.visibility === "public"
      ? "Public"
      : collection.visibility === "unlisted"
        ? "Unlisted"
        : "Private";

  return (
    <div
      className="collection-panel"
      role="tabpanel"
      id="collection-panel-insights"
      aria-labelledby="collection-tab-insights"
    >
      <div className="collection-panel-head">
        <div>
          <h2>Insights</h2>
          <p>A simple view of how often this collection is opened.</p>
        </div>
      </div>

      <div className="collection-insight-stats">
        <div className="collection-insight-stat is-accent">
          <span className="collection-insight-icon"><Eye size={17} /></span>
          <span className="collection-insight-value">
            {formatViewCount(analytics.viewCount)}
          </span>
          <span className="collection-insight-label">Total views</span>
          <small>{analytics.viewCount === 1 ? "1 page view" : `${analytics.viewCount.toLocaleString()} page views`}</small>
        </div>
        <div className="collection-insight-stat">
          <span className="collection-insight-icon"><Activity size={17} /></span>
          <span className="collection-insight-value">
            {analytics.lastViewedAt
              ? now
                ? formatRelativeDate(analytics.lastViewedAt, now)
                : utcDate(analytics.lastViewedAt)
              : "Never"}
          </span>
          <span className="collection-insight-label">Last viewed</span>
          <small>
            {analytics.lastViewedAt
              ? utcDate(analytics.lastViewedAt)
              : "No tracked views yet"}
          </small>
        </div>
        <div className="collection-insight-stat">
          <span className="collection-insight-icon"><CalendarDays size={17} /></span>
          <span className="collection-insight-value">
            {daysLive === null ? "—" : daysLive.toLocaleString()}
          </span>
          <span className="collection-insight-label">
            {daysLive === 1 ? "Day live" : "Days live"}
          </span>
          <small>Created {utcDate(collection.createdAt)}</small>
        </div>
        <div className="collection-insight-stat">
          <span className="collection-insight-icon"><Share2 size={17} /></span>
          <span className="collection-insight-value">
            {daysLive === null ? "—" : formatViewCount(Math.round(viewsPerDay))}
          </span>
          <span className="collection-insight-label">Views per day</span>
          <small>Average since the collection was created</small>
        </div>
      </div>

      <div className="collection-insight-grid">
        <section className="collection-insight-card">
          <div className="collection-insight-card-head">
            <h3>Content mix</h3>
            <span>{counts.total} total</span>
          </div>
          {mix.length === 0 ? (
            <p className="collection-insight-empty">
              Add photos or media to see the collection composition.
            </p>
          ) : (
            <div className="collection-mix">
              {mix.map((entry) => {
                const percent = counts.total
                  ? Math.round((entry.count / counts.total) * 100)
                  : 0;
                return (
                  <div key={entry.label} className="collection-mix-row">
                    <span className="collection-mix-label">
                      {entry.icon} {entry.label}
                    </span>
                    <div className="collection-mix-track" aria-hidden="true">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <span className="collection-mix-count">{entry.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="collection-insight-card">
          <div className="collection-insight-card-head">
            <h3>Sharing status</h3>
            <span className={`collections-badge collections-visibility is-${collection.visibility}`}>
              {collection.visibility === "public" ? <Globe size={12} /> : collection.visibility === "unlisted" ? <Share2 size={12} /> : <Lock size={12} />}
              {visibilityLabel}
            </span>
          </div>
          <dl className="collection-insight-list">
            <div>
              <dt>Share link</dt>
              <dd>{detail.sharePath ? "Available" : "Not created"}</dd>
            </div>
            <div>
              <dt>Preview views</dt>
              <dd>Excluded from totals</dd>
            </div>
            <div>
              <dt>Types tracked</dt>
              <dd>Total page views only</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{counts.total}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="collections-notice">
        <Eye size={16} />
        <span>
          Views are recorded after the shared page loads on someone&apos;s device.
          Admin previews use <code>?preview=1</code> and never add to the total.
          Unique visitors and daily breakdowns are intentionally not collected.
        </span>
      </div>
    </div>
  );
}
