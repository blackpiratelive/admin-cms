"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  EyeOff,
  Images,
  Loader2,
  Play,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import {
  knockoutProgress,
  knockoutRoundLabel,
  type KnockoutRequestedSize,
  type KnockoutSizeOption,
  type KnockoutState,
} from "@/features/libraries/collection-knockout";
import type { CollectionKnockoutSummary } from "@/features/libraries/collection-types";

interface KnockoutIntroProps {
  collectionName: string;
  photoCount: number;
  options: KnockoutSizeOption[];
  summary: CollectionKnockoutSummary | null;
  savedState: KnockoutState | null;
  starting: boolean;
  onStart: (size: KnockoutRequestedSize) => void;
  onResume: () => void;
  onViewResult: () => void;
}

const STEPS = [
  {
    icon: <Images size={18} />,
    title: "Two photos, side by side",
    body: "No titles, dates, locations, or camera details. Just the pictures.",
  },
  {
    icon: <Sparkles size={18} />,
    title: "Pick your favorite",
    body: "Every choice moves one photo forward until a champion is left standing.",
  },
  {
    icon: <Trophy size={18} />,
    title: "Meet your champion",
    body: "The reveal shows the full frame and its story. Your votes also join an anonymous crowd ranking.",
  },
];

export function KnockoutIntro({
  collectionName,
  photoCount,
  options,
  summary,
  savedState,
  starting,
  onStart,
  onResume,
  onViewResult,
}: KnockoutIntroProps) {
  const [selected, setSelected] = useState<KnockoutRequestedSize>(
    () => options[0]?.value ?? "all"
  );

  useEffect(() => {
    if (!options.some((option) => option.value === selected)) {
      setSelected(options[0]?.value ?? "all");
    }
  }, [options, selected]);

  const selectedOption =
    options.find((option) => option.value === selected) || options[0] || null;
  const inProgress = savedState && !savedState.championPhotoId ? savedState : null;
  const completed = savedState && savedState.championPhotoId ? savedState : null;
  const progress = inProgress ? knockoutProgress(inProgress) : null;

  return (
    <main className="public-knockout-intro">
      <section className="public-knockout-hero">
        <span className="public-knockout-eyebrow">
          <Trophy size={14} /> Best Pic Knockout
        </span>
        <h1>
          Two photos.
          <br />
          One winner.
        </h1>
        <p>
          A blind single-elimination tournament for <strong>{collectionName}</strong>. Follow
          your eye, crown a personal champion, and add your anonymous votes to the crowd
          ranking.
        </p>
        <div className="public-knockout-hero-meta">
          <span>
            <Images size={14} /> {photoCount} photos
          </span>
          <span>
            <EyeOff size={14} /> Fully blind
          </span>
          {summary && summary.completedRuns > 0 && (
            <span>
              <Trophy size={14} /> {summary.completedRuns} champion
              {summary.completedRuns === 1 ? "" : "s"} crowned
            </span>
          )}
          {summary && summary.totalVotes > 0 && (
            <span>
              {summary.totalVotes.toLocaleString("en-US")} anonymous vote
              {summary.totalVotes === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </section>

      {inProgress && progress && (
        <section className="public-knockout-resume" aria-label="Resume knockout">
          <div>
            <span className="public-knockout-resume-label">Bracket in progress</span>
            <h2>
              {knockoutRoundLabel(inProgress)} · Match {progress.matchNumber} of{" "}
              {progress.totalMatches}
            </h2>
            <p>{progress.percent}% complete. Your picks are saved in this browser.</p>
          </div>
          <button type="button" className="public-knockout-button is-primary" onClick={onResume}>
            <Play size={16} /> Resume
          </button>
        </section>
      )}

      {completed && (
        <section className="public-knockout-resume is-complete" aria-label="View saved result">
          <div>
            <span className="public-knockout-resume-label">Your bracket is complete</span>
            <h2>Your champion is ready to meet you.</h2>
            <p>The full reveal is waiting — photo, story, final four, and the crowd.</p>
          </div>
          <button
            type="button"
            className="public-knockout-button is-primary"
            onClick={onViewResult}
          >
            <Trophy size={16} /> See your champion
          </button>
        </section>
      )}

      <section className="public-knockout-how" aria-label="How it works">
        {STEPS.map((step, index) => (
          <article key={step.title} className="public-knockout-step">
            <div className="public-knockout-step-icon">{step.icon}</div>
            <div>
              <span>Step {index + 1}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="public-knockout-picker" aria-label="Choose bracket size">
        <div className="public-knockout-picker-head">
          <div>
            <span className="public-knockout-resume-label">Choose your bracket</span>
            <h2>How deep do you want to go?</h2>
          </div>
          <span className="public-knockout-picker-time">
            <Timer size={14} />
            {selectedOption ? `About ${selectedOption.minutes} min` : "Choose a size"}
          </span>
        </div>

        <div className="public-knockout-size-grid" role="radiogroup" aria-label="Bracket size">
          {options.map((option) => {
            const active = option.value === selected;
            return (
              <button
                key={String(option.value)}
                type="button"
                role="radio"
                aria-checked={active}
                className={`public-knockout-size${active ? " is-active" : ""}`}
                onClick={() => setSelected(option.value)}
                disabled={starting}
              >
                <span className="public-knockout-size-count">{option.count}</span>
                <span className="public-knockout-size-label">{option.label}</span>
                <span className="public-knockout-size-meta">
                  {option.count - 1} matchup{option.count - 1 === 1 ? "" : "s"} · ~
                  {option.minutes} min
                </span>
              </button>
            );
          })}
        </div>

        <div className="public-knockout-start-row">
          <button
            type="button"
            className="public-knockout-button is-primary is-large"
            onClick={() => selectedOption && onStart(selectedOption.value)}
            disabled={starting || !selectedOption}
          >
            {starting ? <Loader2 size={18} className="spin" /> : <Play size={18} />}
            {inProgress ? "Start a fresh bracket" : "Start the knockout"}
            {!starting && <ArrowRight size={16} />}
          </button>
          <p>
            Every visit shuffles a fresh bracket. Your picks stay in this browser and can be
            resumed at any time.
          </p>
        </div>

        <div className="public-knockout-blind-note">
          <EyeOff size={16} />
          <p>
            <strong>No spoilers.</strong> Titles, dates, locations, and EXIF stay hidden until
            the final reveal. Crowd results appear after 10 votes, and each photo needs at least
            3 matchups to qualify.
          </p>
        </div>
      </section>
    </main>
  );
}
