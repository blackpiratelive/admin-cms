"use client";

import React from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  Crown,
  ExternalLink,
  Link2,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  MIN_CROWD_VOTES,
  type KnockoutState,
} from "@/features/libraries/collection-knockout";
import type {
  CollectionKnockoutReveal,
  KnockoutDeckPhoto,
  KnockoutRevealPhoto,
} from "@/features/libraries/collection-types";

interface KnockoutRevealProps {
  state: KnockoutState;
  reveal: CollectionKnockoutReveal | null;
  revealLoading: boolean;
  revealError: boolean;
  championId: string;
  finalistIds: string[];
  photosById: Map<string, KnockoutDeckPhoto>;
  albumPath: string;
  copied: boolean;
  onPlayAgain: () => void;
  onCopyLink: () => void;
  onRetryReveal: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function KnockoutReveal({
  state,
  reveal,
  revealLoading,
  revealError,
  championId,
  finalistIds,
  photosById,
  albumPath,
  copied,
  onPlayAgain,
  onCopyLink,
  onRetryReveal,
}: KnockoutRevealProps) {
  const revealPhotos = new Map<string, KnockoutRevealPhoto>(
    (reveal?.photos ?? []).map((photo) => [photo.id, photo])
  );
  const champion = revealPhotos.get(championId) || null;
  const championDeckPhoto = photosById.get(championId) || null;
  const crowd = reveal?.crowd ?? null;
  const crowdReady = Boolean(crowd?.ready && crowd.standings.length > 0);
  const crowdProgress = crowd
    ? Math.min(100, Math.round((crowd.totalVotes / MIN_CROWD_VOTES) * 100))
    : 0;
  const finalists = finalistIds.length
    ? finalistIds
    : championId
      ? [championId]
      : [];

  return (
    <main className="public-knockout-reveal">
      <header className="public-knockout-reveal-head">
        <span className="public-knockout-eyebrow">
          <Sparkles size={14} /> The reveal
        </span>
        <h1>Your eye has spoken.</h1>
        <p>
          {state.picks.length} pick{state.picks.length === 1 ? "" : "s"} later, one photograph
          stands above the rest. Here it is — in full.
        </p>
      </header>

      {revealLoading && !champion && (
        <section className="public-knockout-reveal-loading" aria-live="polite">
          <Loader2 size={28} className="spin" />
          <h2>Developing your champion…</h2>
          <p>Pulling the frame and its story out of the darkroom.</p>
        </section>
      )}

      {(champion || championDeckPhoto) && (
        <section className="public-knockout-champion-card">
          <div className="public-knockout-champion-frame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={champion?.largeUrl || championDeckPhoto?.largeUrl || championDeckPhoto?.mediumUrl}
              alt={champion?.title || "Your knockout champion"}
            />
            <span className="public-knockout-champion-ribbon">
              <Crown size={15} /> Your champion
            </span>
          </div>
          <div className="public-knockout-champion-body">
            <span className="public-knockout-resume-label">Winner of your bracket</span>
            <h2>{champion?.title || "Your champion"}</h2>
            {champion?.camera && (
              <div className="public-knockout-shot-on">
                <Camera size={16} />
                <span>
                  Shot on <strong>{champion.camera}</strong>
                  {champion.lens ? ` · ${champion.lens}` : ""}
                </span>
              </div>
            )}
            {champion?.description && <p>{champion.description}</p>}

            {champion ? (
              <dl className="public-knockout-specs">
                <SpecRow
                  label={champion.takenAt ? "Taken" : "Added"}
                  value={formatDate(champion.takenAt || champion.createdAt)}
                />
                <SpecRow label="Location" value={champion.locationName} />
                <SpecRow label="Lens" value={champion.lens} />
                <SpecRow label="Focal length" value={champion.focalLength} />
                <SpecRow label="Aperture" value={champion.aperture} />
                <SpecRow label="Shutter" value={champion.shutterSpeed} />
                <SpecRow label="ISO" value={champion.iso} />
              </dl>
            ) : (
              <p className="public-knockout-reveal-note">
                The bracket result is saved. The photograph&apos;s details could not be loaded
                right now.
                <button type="button" onClick={onRetryReveal}>
                  Try again
                </button>
              </p>
            )}
          </div>
        </section>
      )}

      <section className="public-knockout-final-four">
        <div className="public-knockout-section-head">
          <div>
            <span className="public-knockout-resume-label">So close</span>
            <h2>{finalists.length >= 4 ? "The final four" : "Your finalists"}</h2>
          </div>
          <span>{state.participantCount} photos entered</span>
        </div>
        <div className="public-knockout-final-grid">
          {finalists.map((id) => {
            const photo = revealPhotos.get(id);
            const deckPhoto = photosById.get(id);
            const isChampion = id === championId;
            return (
              <article
                key={id}
                className={`public-knockout-final-card${isChampion ? " is-champion" : ""}`}
              >
                <div className="public-knockout-final-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo?.mediumUrl || deckPhoto?.mediumUrl || deckPhoto?.thumbnailUrl}
                    alt={photo?.title || "Finalist photo"}
                    loading="lazy"
                  />
                  {isChampion && (
                    <span className="public-knockout-final-crown">
                      <Crown size={13} /> Champion
                    </span>
                  )}
                </div>
                <div className="public-knockout-final-body">
                  <h3>{photo?.title || (isChampion ? "Your champion" : "Finalist")}</h3>
                  {photo?.camera && <span>{photo.camera}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="public-knockout-crowd">
        <div className="public-knockout-section-head">
          <div>
            <span className="public-knockout-resume-label">Anonymous crowd ranking</span>
            <h2>{crowdReady ? "The crowd's top three" : "The crowd is still deciding"}</h2>
          </div>
          {crowd && (
            <span>
              <Users size={14} /> {crowd.totalVotes} vote{crowd.totalVotes === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {crowdReady && crowd ? (
          <ol className="public-knockout-crowd-list">
            {crowd.standings.map((entry, index) => (
              <li key={entry.photoId} className="public-knockout-crowd-row">
                <span className="public-knockout-crowd-rank">{index + 1}</span>
                <div className="public-knockout-crowd-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.thumbnailUrl} alt={entry.title} loading="lazy" />
                </div>
                <div className="public-knockout-crowd-info">
                  <h3>{entry.title}</h3>
                  <span>
                    {entry.wins}W–{entry.losses}L · {entry.matches} matchup
                    {entry.matches === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="public-knockout-crowd-elo">
                  <strong>{Math.round(entry.elo)}</strong>
                  <span>Elo</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="public-knockout-crowd-waiting">
            <div className="public-knockout-crowd-progress">
              <span style={{ width: `${crowdProgress}%` }} />
            </div>
            <div>
              <strong>
                {crowd ? Math.min(crowd.totalVotes, MIN_CROWD_VOTES) : 0} / {MIN_CROWD_VOTES}{" "}
                votes
              </strong>
              <p>
                The crowd champion appears once 10 votes are in and a photo has at least 3
                matchups. Your picks are already in the queue.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="public-knockout-actions">
        <button type="button" className="public-knockout-button is-primary" onClick={onPlayAgain}>
          <RotateCcw size={16} /> Play again
        </button>
        <Link href={albumPath} className="public-knockout-button is-secondary">
          <ExternalLink size={16} /> Back to the album
        </Link>
        <button type="button" className="public-knockout-button is-ghost" onClick={onCopyLink}>
          {copied ? <Check size={16} /> : <Link2 size={16} />}
          {copied ? "Link copied" : "Copy knockout link"}
        </button>
      </div>

      {revealError && (
        <p className="public-knockout-sync-note" role="status">
          <Trophy size={14} /> Your personal result is safe. The crowd details are taking a
          little longer to load.
        </p>
      )}
    </main>
  );
}
