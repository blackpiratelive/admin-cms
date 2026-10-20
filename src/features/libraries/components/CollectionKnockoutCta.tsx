"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, Sparkles, Trophy } from "lucide-react";
import {
  allKnockoutPhotoIds,
  hashPhotoPool,
  isValidKnockoutState,
  knockoutProgress,
  type KnockoutState,
} from "@/features/libraries/collection-knockout";
import { loadKnockoutState } from "./public/knockout-storage";

interface CollectionKnockoutCtaProps {
  collectionId: string;
  photoIds: string[];
  knockoutPath: string;
  accentColor?: string | null;
  preview?: boolean;
}

export function CollectionKnockoutCta({
  collectionId,
  photoIds,
  knockoutPath,
  accentColor,
  preview = false,
}: CollectionKnockoutCtaProps) {
  const [saved, setSaved] = useState<KnockoutState | null>(null);
  const poolHash = useMemo(() => hashPhotoPool(photoIds), [photoIds]);

  useEffect(() => {
    const candidate = loadKnockoutState(collectionId);
    if (!candidate || !isValidKnockoutState(candidate)) {
      setSaved(null);
      return;
    }
    if (candidate.collectionId !== collectionId || candidate.poolHash !== poolHash) {
      setSaved(null);
      return;
    }
    const ids = allKnockoutPhotoIds(candidate);
    if (
      (candidate.championPhotoId && !photoIds.includes(candidate.championPhotoId)) ||
      ids.length !== candidate.participantCount ||
      !ids.every((id) => photoIds.includes(id))
    ) {
      setSaved(null);
      return;
    }
    setSaved(candidate);
    // The pool hash changes whenever the photo set changes, which invalidates saved runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, poolHash]);

  const progress = saved && !saved.championPhotoId ? knockoutProgress(saved) : null;
  const completed = Boolean(saved?.championPhotoId);

  return (
    <section
      className="public-knockout-cta"
      style={
        {
          "--knockout-accent": accentColor || "#ff6600",
        } as React.CSSProperties
      }
      aria-label="Best Pic Knockout"
    >
      <div className="public-knockout-cta-icon">
        <Trophy size={22} />
      </div>
      <div className="public-knockout-cta-body">
        <span className="public-knockout-cta-eyebrow">
          <Sparkles size={12} /> Best Pic Knockout
          {preview && <em>Preview</em>}
        </span>
        <h2>
          {completed
            ? "Your champion is waiting."
            : progress
              ? "Your bracket is still open."
              : "Which photo is the best?"}
        </h2>
        <p>
          {completed
            ? "The reveal is saved in this browser. Meet your winner, see the final four, and check the crowd."
            : progress
              ? `You are on match ${progress.matchNumber} of ${progress.totalMatches}. Pick up where you left off — no spoilers.`
              : "Two photos at a time, completely blind. Crown a personal champion and add anonymous votes to the crowd ranking."}
        </p>
        <div className="public-knockout-cta-meta">
          <span>
            <EyeOff size={13} /> No titles or EXIF until the reveal
          </span>
          <span>{photoIds.length} photos</span>
        </div>
      </div>
      <Link href={knockoutPath} className="public-knockout-cta-button">
        {completed ? (
          <>
            See your champion <ArrowRight size={16} />
          </>
        ) : progress ? (
          <>
            Resume · Match {progress.matchNumber} <ArrowRight size={16} />
          </>
        ) : (
          <>
            Start the knockout <ArrowRight size={16} />
          </>
        )}
      </Link>
    </section>
  );
}
