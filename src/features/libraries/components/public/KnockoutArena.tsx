"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Undo2 } from "lucide-react";
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
          onPick(match.a);
        }
      } else if (key === "2" || key === "b" || event.key === "ArrowRight") {
        if (match.b) {
          event.preventDefault();
          onPick(match.b);
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canUndo, crowning, match.a, match.b, onPick, onUndo]);

  useEffect(() => {
    for (const id of [match.a, match.b]) {
      const photo = id ? photosById.get(id) : null;
      if (!photo) continue;
      const image = new Image();
      image.src = photo.mediumUrl;
    }
  }, [match.a, match.b, photosById]);

  const renderPanel = (side: "a" | "b", photoId: string | null) => {
    const photo = photoId ? photosById.get(photoId) : null;
    const letter = side.toUpperCase();
    const isWinner = Boolean(photoId && match.winner === photoId);
    const isLoser = Boolean(crowning && match.winner && photoId && match.winner !== photoId);

    return (
      <button
        type="button"
        className={`public-knockout-panel${isWinner ? " is-winner" : ""}${
          isLoser ? " is-loser" : ""
        }`}
        onClick={() => photoId && !crowning && onPick(photoId)}
        disabled={!photoId || crowning}
        aria-label={photo ? `Choose photo ${letter}` : `Photo ${letter} unavailable`}
      >
        <span className="public-knockout-panel-letter">{letter}</span>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.mediumUrl}
            alt={`Photo ${letter}`}
            draggable={false}
            decoding="async"
          />
        ) : (
          <span className="public-knockout-panel-placeholder">Photo {letter}</span>
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
