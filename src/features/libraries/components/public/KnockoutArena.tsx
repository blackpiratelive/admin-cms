"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ImageOff, Loader2, RefreshCw, Undo2 } from "lucide-react";
import type {
  KnockoutDeckPhoto,
} from "@/features/libraries/collection-types";
import type { KnockoutMatch } from "@/features/libraries/collection-knockout";

interface KnockoutArenaProps {
  match: KnockoutMatch;
  photosById: Map<string, KnockoutDeckPhoto>;
  albumPath: string;
  roundLabel: string;
  matchNumber: number;
  totalMatches: number;
  percent: number;
  canUndo: boolean;
  crowning: boolean;
  onPick: (photoId: string) => void;
  onUndo: () => void;
}

type PhotoLoadState = "loading" | "loaded" | "error";

function versionedImageUrl(url: string, retryKey: number): string {
  if (!retryKey) return url;
  return `${url}${url.includes("?") ? "&" : "?"}retry=${retryKey}`;
}

export function KnockoutArena({
  match,
  photosById,
  albumPath,
  roundLabel,
  matchNumber,
  totalMatches,
  percent,
  canUndo,
  crowning,
  onPick,
  onUndo,
}: KnockoutArenaProps) {
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoLoadState>>({});
  const [retryKeys, setRetryKeys] = useState<Record<string, number>>({});
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const imageRefs = useRef<Record<string, HTMLImageElement | null>>({});

  const matchPhotoIds = [match.a, match.b].filter(
    (id): id is string => Boolean(id)
  );
  const bothLoaded =
    matchPhotoIds.length === 2 &&
    matchPhotoIds.every((id) => photoStates[id] === "loaded");
  const imageError = matchPhotoIds.some((id) => photoStates[id] === "error");
  const retryKeyA = match.a ? retryKeys[match.a] ?? 0 : 0;
  const retryKeyB = match.b ? retryKeys[match.b] ?? 0 : 0;

  const markPhotoLoaded = useCallback((photoId: string) => {
    setPhotoStates((previous) =>
      previous[photoId] === "loaded"
        ? previous
        : { ...previous, [photoId]: "loaded" }
    );
  }, []);

  const markPhotoError = useCallback((photoId: string) => {
    setPhotoStates((previous) =>
      previous[photoId] === "error"
        ? previous
        : { ...previous, [photoId]: "error" }
    );
  }, []);

  useEffect(() => {
    for (const id of [match.a, match.b]) {
      if (!id) continue;
      const image = imageRefs.current[id];
      if (!image || !image.complete) continue;
      if (image.naturalWidth > 0) {
        markPhotoLoaded(id);
      } else {
        markPhotoError(id);
      }
    }
  }, [match.a, match.b, retryKeyA, retryKeyB, markPhotoLoaded, markPhotoError]);

  useEffect(() => {
    setImageWarning(null);
  }, [match.a, match.b]);

  useEffect(() => {
    if (bothLoaded) setImageWarning(null);
  }, [bothLoaded]);

  const attemptPick = useCallback(
    (photoId: string) => {
      if (crowning) return;
      // The displayed <img> elements are the source of truth: a photo that was
      // loaded in an earlier round might no longer be in the browser cache.
      const imagesComplete =
        Boolean(match.a && match.b) &&
        [match.a, match.b].every((id) => {
          const image = id ? imageRefs.current[id] : null;
          return Boolean(image && image.complete && image.naturalWidth > 0);
        });
      if (!imagesComplete) {
        setImageWarning(
          imageError
            ? "One of these photos could not be downloaded. Retry the download before voting."
            : "Voting is locked until both photos finish downloading."
        );
        return;
      }
      setImageWarning(null);
      onPick(photoId);
    },
    [crowning, imageError, match.a, match.b, onPick]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "u" || event.key === "Backspace") {
        if (canUndo) {
          event.preventDefault();
          onUndo();
        }
        return;
      }
      if (crowning) return;

      if (key === "1" || key === "a" || event.key === "ArrowLeft") {
        if (match.a) {
          event.preventDefault();
          attemptPick(match.a);
        }
      } else if (key === "2" || key === "b" || event.key === "ArrowRight") {
        if (match.b) {
          event.preventDefault();
          attemptPick(match.b);
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [attemptPick, canUndo, crowning, match.a, match.b, onUndo]);

  const retryImages = () => {
    const failedIds = matchPhotoIds.filter(
      (id) => photoStates[id] === "error"
    );
    if (failedIds.length === 0) return;
    setImageWarning(null);
    setPhotoStates((previous) => {
      const next = { ...previous };
      for (const id of failedIds) next[id] = "loading";
      return next;
    });
    setRetryKeys((previous) => {
      const next = { ...previous };
      for (const id of failedIds) next[id] = (next[id] ?? 0) + 1;
      return next;
    });
  };

  const renderPanel = (side: "a" | "b", photoId: string | null) => {
    const photo = photoId ? photosById.get(photoId) : null;
    const letter = side.toUpperCase();
    const isWinner = Boolean(photoId && match.winner === photoId);
    const isLoser = Boolean(crowning && match.winner && photoId && match.winner !== photoId);
    const loadState = photoId ? photoStates[photoId] ?? "loading" : null;
    const isLoading = loadState === "loading";
    const hasError = loadState === "error";

    return (
      <button
        type="button"
        className={`public-knockout-panel${isWinner ? " is-winner" : ""}${
          isLoser ? " is-loser" : ""
        }${isLoading ? " is-loading" : ""}${hasError ? " has-error" : ""}`}
        onClick={() => photoId && attemptPick(photoId)}
        disabled={!photoId || crowning}
        aria-busy={isLoading || undefined}
        aria-label={
          photo
            ? hasError
              ? `Photo ${letter} could not be downloaded`
              : isLoading
                ? `Photo ${letter} is still downloading`
                : `Choose photo ${letter}`
            : `Photo ${letter} unavailable`
        }
      >
        <span className="public-knockout-panel-letter">{letter}</span>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.id}
            ref={(node) => {
              imageRefs.current[photo.id] = node;
            }}
            src={versionedImageUrl(photo.mediumUrl, retryKeys[photo.id] ?? 0)}
            alt={`Photo ${letter}`}
            draggable={false}
            decoding="async"
            fetchPriority="high"
            onLoad={() => markPhotoLoaded(photo.id)}
            onError={() => markPhotoError(photo.id)}
          />
        ) : (
          <span className="public-knockout-panel-placeholder">Photo {letter}</span>
        )}
        {photo && loadState !== "loaded" && (
          <span
            className={`public-knockout-panel-loading${hasError ? " is-error" : ""}`}
            aria-hidden="true"
          >
            {hasError ? <ImageOff size={15} /> : <Loader2 size={15} className="spin" />}
            {hasError ? "Download failed" : "Downloading"}
          </span>
        )}
        {isWinner && (
          <span className="public-knockout-panel-check">
            <Check size={18} /> Winner
          </span>
        )}
      </button>
    );
  };

  return (
    <main className="public-knockout-arena">
      <header className="public-knockout-arena-head">
        <div className="public-knockout-arena-topline">
          <Link href={albumPath} className="public-knockout-exit">
            <ArrowLeft size={14} /> Album
          </Link>
          <span className="public-knockout-round">{roundLabel}</span>
          <span className="public-knockout-match-count">
            Match {matchNumber} of {totalMatches}
          </span>
        </div>
        <div
          className="public-knockout-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Knockout progress"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </header>

      {!crowning && (!bothLoaded || imageWarning) && (
        <div
          className={`public-knockout-image-warning${
            imageWarning || imageError ? " is-error" : ""
          }`}
          role={imageWarning ? "alert" : "status"}
        >
          {!imageWarning && !imageError && (
            <Loader2 size={13} className="spin" aria-hidden="true" />
          )}
          <span>
            {imageWarning ??
              (imageError
                ? "A photo could not be downloaded."
                : "Downloading both photos… voting unlocks when they finish.")}
          </span>
          {imageError && (
            <button type="button" onClick={retryImages}>
              <RefreshCw size={12} /> Retry download
            </button>
          )}
        </div>
      )}

      <div className="public-knockout-match">
        {renderPanel("a", match.a)}
        <span className="public-knockout-vs" aria-hidden="true">
          VS
        </span>
        {renderPanel("b", match.b)}
      </div>

      <footer className="public-knockout-arena-foot">
        <span>
          Pick the picture that stays with you. <strong>No titles. No context.</strong>
        </span>
        <span className="public-knockout-keyhints">
          <kbd>1</kbd>/<kbd>A</kbd>
          <kbd>2</kbd>/<kbd>B</kbd>
          {canUndo && (
            <>
              <kbd>U</kbd> undo
            </>
          )}
        </span>
      </footer>

      {canUndo && !crowning && (
        <div className="public-knockout-undo" role="status">
          <span className="public-knockout-undo-dot" />
          <span>Vote queued</span>
          <button type="button" onClick={onUndo}>
            <Undo2 size={14} /> Undo
          </button>
          <span className="public-knockout-undo-timer" aria-hidden="true" />
        </div>
      )}

      {crowning && (
        <div className="public-knockout-crowning" role="status" aria-live="polite">
          <Loader2 size={22} className="spin" />
          <div>
            <strong>Crowning your champion…</strong>
            <span>One last vote is joining the crowd.</span>
          </div>
          {canUndo && (
            <button type="button" onClick={onUndo}>
              <Undo2 size={14} /> Undo
            </button>
          )}
          {canUndo && <span className="public-knockout-undo-timer" aria-hidden="true" />}
        </div>
      )}
    </main>
  );
}
