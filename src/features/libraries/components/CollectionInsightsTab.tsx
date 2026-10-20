"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  Crown,
  Eye,
  Film,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Music,
  RotateCcw,
  Share2,
  Trophy,
  Tv,
  User,
} from "lucide-react";
import { notify } from "@/lib/notifications";
import {
  formatRelativeDate,
  formatViewCount,
} from "../collection-helpers";
import {
  getCollectionKnockoutAdminStatsAction,
  resetCollectionKnockoutAction,
} from "../actions/collection-knockout";
import type {
  CollectionDetail,
  CollectionKnockoutAdminStats,
} from "../collection-types";

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
  const { analytics, counts, collection } = detail;
  const [now, setNow] = useState<number | null>(null);
  const [knockout, setKnockout] = useState<CollectionKnockoutAdminStats | null>(null);
  const [knockoutLoading, setKnockoutLoading] = useState(collection.kind === "photo");
  const [knockoutError, setKnockoutError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (collection.kind !== "photo") {
      setKnockout(null);
      setKnockoutLoading(false);
      setKnockoutError(null);
      return;
    }

    let active = true;
    setKnockoutLoading(true);
    setKnockoutError(null);
    getCollectionKnockoutAdminStatsAction(collection.id)
      .then((stats) => {
        if (active) setKnockout(stats);
      })
      .catch(() => {
        if (active) setKnockoutError("Could not load Best Pic Knockout insights.");
      })
      .finally(() => {
        if (active) setKnockoutLoading(false);
      });

    return () => {
      active = false;
    };
  }, [collection.id, collection.kind]);

  const resetKnockout = async () => {
    setResetBusy(true);
    setKnockoutError(null);
    try {
      const result = await resetCollectionKnockoutAction(collection.id);
      if (!result.success) {
        setKnockoutError("Could not reset Best Pic Knockout.");
        notify.show({ type: "error", message: "Could not reset Best Pic Knockout." });
        return;
      }
      const stats = await getCollectionKnockoutAdminStatsAction(collection.id);
      setKnockout(stats);
      setResetOpen(false);
      notify.show({ type: "success", message: "Best Pic Knockout data reset." });
    } catch {
      setKnockoutError("Could not reset Best Pic Knockout.");
      notify.show({ type: "error", message: "Could not reset Best Pic Knockout." });
    } finally {
      setResetBusy(false);
    }
  };

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

      {collection.kind === "photo" && (
        <section className="collection-insight-card collections-knockout-insights">
          <div className="collection-insight-card-head">
            <h3>
              <Trophy size={14} /> Best Pic Knockout
            </h3>
            {knockout && (
              <span
                className={`collections-badge collections-visibility ${
                  knockout.enabled && knockout.eligible ? "is-public" : "is-private"
                }`}
              >
                {knockout.enabled && knockout.eligible ? (
                  <Trophy size={11} />
                ) : (
                  <Lock size={11} />
                )}
                {!knockout.enabled
                  ? "Paused"
                  : knockout.eligible
                    ? "Live"
                    : "Needs photos"}
              </span>
            )}
          </div>

          {knockoutLoading ? (
            <div className="collections-knockout-loading">
              <Loader2 size={16} className="spin" /> Loading knockout insights…
            </div>
          ) : knockoutError ? (
            <p className="collection-insight-empty">{knockoutError}</p>
          ) : knockout ? (
            <>
              <div className="collections-knockout-stats">
                <div className="collections-knockout-stat">
                  <span>Brackets started</span>
                  <strong>{knockout.startedRuns.toLocaleString()}</strong>
                </div>
                <div className="collections-knockout-stat">
                  <span>Champions crowned</span>
                  <strong>{knockout.completedRuns.toLocaleString()}</strong>
                </div>
                <div className="collections-knockout-stat">
                  <span>Completion rate</span>
                  <strong>
                    {knockout.completionRate == null ? "—" : `${knockout.completionRate}%`}
                  </strong>
                </div>
                <div className="collections-knockout-stat">
                  <span>Anonymous votes</span>
                  <strong>{knockout.totalVotes.toLocaleString()}</strong>
                </div>
                <div className="collections-knockout-stat">
                  <span>Voters</span>
                  <strong>{knockout.uniqueSessions.toLocaleString()}</strong>
                </div>
                <div className="collections-knockout-stat">
                  <span>Last vote</span>
                  <strong>
                    {knockout.lastVoteAt
                      ? now
                        ? formatRelativeDate(knockout.lastVoteAt, now)
                        : utcDate(knockout.lastVoteAt)
                      : "Never"}
                  </strong>
                </div>
              </div>

              {!knockout.eligible ? (
                <p className="collection-insight-empty">
                  Best Pic Knockout needs at least two visible photos in this album.
                </p>
              ) : (
                <div className="collections-knockout-board">
                  <div className="collections-knockout-board-head">
                    <h4>
                      <Crown size={14} /> Crowd leaderboard
                    </h4>
                    <span>
                      {knockout.crowdReady
                        ? "10-vote threshold met"
                        : `${Math.min(knockout.totalVotes, 10)} / 10 votes to reveal`}
                    </span>
                  </div>

                  {knockout.standings.length > 0 ? (
                    <ol className="collections-knockout-list">
                      {knockout.standings.map((entry, index) => (
                        <li key={entry.photoId} className="collections-knockout-row">
                          <span className="collections-knockout-rank">{index + 1}</span>
                          <span className="collections-knockout-thumb">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={entry.thumbnailUrl} alt="" loading="lazy" />
                          </span>
                          <span className="collections-knockout-info">
                            <strong>{entry.title}</strong>
                            <small>
                              {entry.wins}W–{entry.losses}L · {entry.matches} matchup
                              {entry.matches === 1 ? "" : "s"}
                            </small>
                          </span>
                          <span className="collections-knockout-elo">
                            <strong>{Math.round(entry.elo)}</strong>
                            <small>Elo</small>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="collection-insight-empty">
                      No photo has enough matchups yet. The leaderboard fills as visitors
                      play.
                    </p>
                  )}

                  <p className="collections-knockout-threshold">
                    The public crowd list includes only photos with at least 3 matchups.
                    Admin standings show early results too. Only visible photos are
                    counted, and preview runs never write.
                  </p>
                  {!knockout.enabled && (
                    <p className="collections-knockout-paused">
                      <Lock size={12} /> The knockout is paused. Existing votes are kept;
                      turn it back on in Settings to collect new ones.
                    </p>
                  )}
                </div>
              )}

              <div className="collections-knockout-reset">
                {resetOpen ? (
                  <div className="collections-knockout-reset-confirm">
                    <span>
                      Delete all knockout votes and runs for this album? Photos stay
                      untouched. This cannot be undone.
                    </span>
                    <div>
                      <button
                        type="button"
                        className="collections-btn collections-btn-ghost collections-btn-sm"
                        onClick={() => setResetOpen(false)}
                        disabled={resetBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="collections-btn collections-btn-danger collections-btn-sm"
                        onClick={resetKnockout}
                        disabled={resetBusy}
                      >
                        {resetBusy ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <RotateCcw size={13} />
                        )}
                        Reset knockout
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="collections-btn collections-btn-ghost collections-btn-sm"
                    onClick={() => setResetOpen(true)}
                    disabled={knockout.startedRuns === 0 && knockout.totalVotes === 0}
                  >
                    <RotateCcw size={13} /> Reset knockout data
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="collection-insight-empty">
              No knockout activity to show yet.
            </p>
          )}
        </section>
      )}

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
