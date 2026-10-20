"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allKnockoutPhotoIds,
  buildKnockout,
  getCurrentMatch,
  hashPhotoPool,
  isValidKnockoutState,
  knockoutFinalists,
  knockoutProgress,
  knockoutRoundLabel,
  knockoutSizeOptions,
  pickKnockoutWinner,
  type KnockoutMatch,
  type KnockoutRequestedSize,
  type KnockoutState,
} from "@/features/libraries/collection-knockout";
import {
  completeCollectionKnockoutAction,
  getCollectionKnockoutRevealAction,
  recordCollectionKnockoutVoteAction,
  startCollectionKnockoutAction,
} from "@/features/libraries/actions/collection-knockout";
import type {
  CollectionKnockoutDeck,
  CollectionKnockoutReveal,
  CollectionKnockoutSummary,
} from "@/features/libraries/collection-types";
import { KnockoutArena } from "./KnockoutArena";
import { KnockoutIntro } from "./KnockoutIntro";
import { KnockoutReveal } from "./KnockoutReveal";
import {
  clearKnockoutState,
  createKnockoutSeed,
  getKnockoutSessionId,
  loadKnockoutState,
  saveKnockoutState,
} from "./knockout-storage";

interface PublicCollectionKnockoutProps {
  deck: CollectionKnockoutDeck;
  summary: CollectionKnockoutSummary | null;
  token?: string | null;
  preview: boolean;
  albumPath: string;
  knockoutPath: string;
}

type Phase = "intro" | "playing" | "revealing" | "result";

interface VotePayload {
  seed: string;
  round: number;
  matchIndex: number;
  winnerPhotoId: string;
  loserPhotoId: string;
}

interface PendingVote {
  previousState: KnockoutState;
  nextState: KnockoutState;
  vote: VotePayload;
  timer: ReturnType<typeof setTimeout>;
}

interface RuntimeConfig {
  slug: string;
  token: string | null;
  preview: boolean;
  sessionId: string;
}

function voteKey(vote: VotePayload): string {
  return `${vote.seed}:${vote.round}:${vote.matchIndex}`;
}

export function PublicCollectionKnockout({
  deck,
  summary,
  token,
  preview,
  albumPath,
  knockoutPath,
}: PublicCollectionKnockoutProps) {
  const photoIds = useMemo(() => deck.photos.map((photo) => photo.id), [deck.photos]);
  const poolHash = useMemo(() => hashPhotoPool(photoIds), [photoIds]);
  const photosById = useMemo(
    () => new Map(deck.photos.map((photo) => [photo.id, photo])),
    [deck.photos]
  );
  const options = useMemo(() => knockoutSizeOptions(deck.photos.length), [deck.photos.length]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [state, setState] = useState<KnockoutState | null>(null);
  const [savedState, setSavedState] = useState<KnockoutState | null>(null);
  const [lastMatch, setLastMatch] = useState<KnockoutMatch | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reveal, setReveal] = useState<CollectionKnockoutReveal | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const pendingRef = useRef<PendingVote | null>(null);
  const failedVotesRef = useRef<VotePayload[]>([]);
  const completedSeedsRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string>("");
  const configRef = useRef<RuntimeConfig>({
    slug: deck.collection.slug,
    token: token ?? null,
    preview,
    sessionId: "",
  });

  const isStateForDeck = useCallback(
    (candidate: KnockoutState | null): candidate is KnockoutState => {
      if (!candidate || !isValidKnockoutState(candidate)) return false;
      if (candidate.collectionId !== deck.collection.id) return false;
      if (candidate.poolHash !== poolHash) return false;
      const ids = allKnockoutPhotoIds(candidate);
      if (candidate.championPhotoId && !photosById.has(candidate.championPhotoId)) {
        return false;
      }
      return (
        ids.length === candidate.participantCount && ids.every((id) => photosById.has(id))
      );
    },
    [deck.collection.id, photosById, poolHash]
  );

  const sendVote = useCallback(async (vote: VotePayload): Promise<boolean> => {
    const config = configRef.current;
    if (config.preview) return true;
    const sessionId = config.sessionId || getKnockoutSessionId();
    if (sessionId) {
      sessionIdRef.current = sessionId;
      configRef.current = { ...configRef.current, sessionId };
    }
    try {
      const result = await recordCollectionKnockoutVoteAction({
        slug: config.slug,
        token: config.token,
        sessionId,
        preview: config.preview,
        ...vote,
      });
      if (!result.success) {
        const key = voteKey(vote);
        if (!failedVotesRef.current.some((entry) => voteKey(entry) === key)) {
          failedVotesRef.current.push(vote);
        }
        setSyncWarning("The crowd server is out of reach. Your personal bracket is safe.");
        return false;
      }
      if (failedVotesRef.current.length === 0) setSyncWarning(null);
      return true;
    } catch {
      const key = voteKey(vote);
      if (!failedVotesRef.current.some((entry) => voteKey(entry) === key)) {
        failedVotesRef.current.push(vote);
      }
      setSyncWarning("The crowd server is out of reach. Your personal bracket is safe.");
      return false;
    }
  }, []);

  const flushFailedVotes = useCallback(async () => {
    if (failedVotesRef.current.length === 0) return;
    const queue = failedVotesRef.current.slice();
    failedVotesRef.current = [];
    for (const vote of queue) {
      await sendVote(vote);
    }
    if (failedVotesRef.current.length === 0) setSyncWarning(null);
  }, [sendVote]);

  const sendComplete = useCallback(async (nextState: KnockoutState) => {
    if (!nextState.championPhotoId) return;
    if (completedSeedsRef.current.has(nextState.seed)) return;
    const config = configRef.current;
    if (config.preview) return;
    completedSeedsRef.current.add(nextState.seed);
    const sessionId = config.sessionId || getKnockoutSessionId();
    try {
      const result = await completeCollectionKnockoutAction({
        slug: config.slug,
        token: config.token,
        sessionId,
        seed: nextState.seed,
        poolHash: nextState.poolHash,
        bracketSize: (nextState.rounds[0]?.matches.length ?? 1) * 2,
        championPhotoId: nextState.championPhotoId,
        matchesPlayed: nextState.picks.length,
        preview: config.preview,
      });
      if (!result.success) completedSeedsRef.current.delete(nextState.seed);
    } catch {
      completedSeedsRef.current.delete(nextState.seed);
    }
  }, []);

  const loadReveal = useCallback(
    async (nextState: KnockoutState) => {
      if (!nextState.championPhotoId) return;
      setRevealLoading(true);
      setRevealError(false);
      const ids = Array.from(
        new Set([nextState.championPhotoId, ...knockoutFinalists(nextState)])
      );
      try {
        const result = await getCollectionKnockoutRevealAction({
          slug: deck.collection.slug,
          token: token ?? null,
          photoIds: ids,
        });
        setReveal(result);
        if (!result) setRevealError(true);
      } catch {
        setReveal(null);
        setRevealError(true);
      } finally {
        setRevealLoading(false);
      }
    },
    [deck.collection.slug, token]
  );

  const reconcileCompleted = useCallback(
    async (completed: KnockoutState) => {
      const lastPick = completed.picks[completed.picks.length - 1];
      if (lastPick) {
        await sendVote({
          seed: completed.seed,
          round: lastPick.round,
          matchIndex: lastPick.matchIndex,
          winnerPhotoId: lastPick.winnerId,
          loserPhotoId: lastPick.loserId,
        });
      }
      await sendComplete(completed);
      await loadReveal(completed);
    },
    [loadReveal, sendComplete, sendVote]
  );

  useEffect(() => {
    configRef.current = {
      slug: deck.collection.slug,
      token: token ?? null,
      preview,
      sessionId: sessionIdRef.current,
    };
  }, [deck.collection.slug, token, preview]);

  useEffect(() => {
    const sessionId = getKnockoutSessionId();
    sessionIdRef.current = sessionId;
    configRef.current = { ...configRef.current, sessionId };

    const saved = loadKnockoutState(deck.collection.id);
    if (isStateForDeck(saved)) {
      setSavedState(saved);
      if (saved.championPhotoId) {
        setState(saved);
        setPhase("result");
        void reconcileCompleted(saved);
      }
    } else if (saved) {
      clearKnockoutState(deck.collection.id);
    }
  }, [deck.collection.id, isStateForDeck, reconcileCompleted]);

  useEffect(() => {
    const handleOnline = () => {
      void flushFailedVotes();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushFailedVotes]);

  const flushPendingNow = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setCanUndo(false);
    void sendVote(pending.vote);
    if (pending.nextState.championPhotoId) {
      void sendComplete(pending.nextState);
    }
  }, [sendComplete, sendVote]);

  useEffect(() => {
    return () => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingRef.current = null;
      const config = configRef.current;
      if (config.preview) return;
      const sessionId = config.sessionId || getKnockoutSessionId();
      void recordCollectionKnockoutVoteAction({
        slug: config.slug,
        token: config.token,
        sessionId,
        preview: config.preview,
        ...pending.vote,
      }).catch(() => {});
      if (pending.nextState.championPhotoId) {
        void completeCollectionKnockoutAction({
          slug: config.slug,
          token: config.token,
          sessionId,
          seed: pending.nextState.seed,
          poolHash: pending.nextState.poolHash,
          bracketSize: (pending.nextState.rounds[0]?.matches.length ?? 1) * 2,
          championPhotoId: pending.nextState.championPhotoId,
          matchesPlayed: pending.nextState.picks.length,
          preview: config.preview,
        }).catch(() => {});
      }
    };
  }, []);

  const handleStart = useCallback(
    (requestedSize: KnockoutRequestedSize) => {
      if (starting) return;
      flushPendingNow();
      const seed = createKnockoutSeed();
      const next = buildKnockout({
        collectionId: deck.collection.id,
        photoIds,
        seed,
        requestedSize,
        poolHash,
        now: new Date().toISOString(),
      });
      if (!next) {
        setSyncWarning("This album does not have enough visible photos for a knockout.");
        return;
      }

      setStarting(true);
      completedSeedsRef.current.delete(next.seed);
      saveKnockoutState(next);
      setState(next);
      setSavedState(next);
      setReveal(null);
      setRevealError(false);
      setLastMatch(null);
      setCanUndo(false);
      setPhase("playing");
      setStarting(false);

      const sessionId = sessionIdRef.current || getKnockoutSessionId();
      sessionIdRef.current = sessionId;
      void startCollectionKnockoutAction({
        slug: deck.collection.slug,
        token: token ?? null,
        sessionId,
        seed,
        poolHash,
        requestedSize,
        bracketSize: (next.rounds[0]?.matches.length ?? 1) * 2,
        preview,
      })
        .then((result) => {
          if (!result.success) {
            setSyncWarning(
              result.error || "The album changed. You can still finish your personal bracket."
            );
          }
        })
        .catch(() => {
          setSyncWarning("The crowd server is out of reach. Your personal bracket is safe.");
        });
    },
    [
      deck.collection.id,
      deck.collection.slug,
      flushPendingNow,
      photoIds,
      poolHash,
      preview,
      starting,
      token,
    ]
  );

  const handleResume = useCallback(() => {
    if (!savedState) return;
    setState(savedState);
    if (savedState.championPhotoId) {
      setPhase("result");
      void reconcileCompleted(savedState);
    } else {
      setPhase("playing");
    }
  }, [reconcileCompleted, savedState]);

  const handlePick = useCallback(
    (photoId: string) => {
      if (!state || phase !== "playing") return;
      const match = getCurrentMatch(state);
      if (!match) return;
      if (match.a !== photoId && match.b !== photoId) return;
      const loserId = match.a === photoId ? match.b : match.a;
      if (!loserId) return;

      if (pendingRef.current) flushPendingNow();

      const next = pickKnockoutWinner(state, photoId);
      if (next === state) return;

      const vote: VotePayload = {
        seed: state.seed,
        round: state.currentRound,
        matchIndex: state.currentMatch,
        winnerPhotoId: photoId,
        loserPhotoId: loserId,
      };

      saveKnockoutState(next);
      setState(next);
      setSavedState(next);
      if (next.championPhotoId) {
        setLastMatch({ ...match, winner: photoId });
        setPhase("revealing");
      }

      const timer = setTimeout(() => {
        const pending = pendingRef.current;
        if (!pending || pending.vote !== vote) return;
        pendingRef.current = null;
        setCanUndo(false);
        void (async () => {
          await sendVote(vote);
          if (next.championPhotoId) {
            await sendComplete(next);
            await loadReveal(next);
            setPhase("result");
          }
        })();
      }, 2000);

      pendingRef.current = {
        previousState: state,
        nextState: next,
        vote,
        timer,
      };
      setCanUndo(true);
    },
    [flushPendingNow, loadReveal, phase, sendComplete, sendVote, state]
  );

  const handleUndo = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setCanUndo(false);
    saveKnockoutState(pending.previousState);
    setState(pending.previousState);
    setSavedState(pending.previousState);
    setLastMatch(null);
    setPhase("playing");
  }, []);

  const handlePlayAgain = useCallback(() => {
    flushPendingNow();
    clearKnockoutState(deck.collection.id);
    setState(null);
    setSavedState(null);
    setReveal(null);
    setRevealError(false);
    setRevealLoading(false);
    setLastMatch(null);
    setCanUndo(false);
    setPhase("intro");
  }, [deck.collection.id, flushPendingNow]);

  const handleCopyLink = useCallback(async () => {
    try {
      const url = `${window.location.origin}${knockoutPath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }, [knockoutPath]);

  const currentMatch = state ? getCurrentMatch(state) : null;
  const progress = state ? knockoutProgress(state) : null;
  const activeMatch = phase === "revealing" && lastMatch ? lastMatch : currentMatch;
  const finalistIds = state ? knockoutFinalists(state) : [];

  const previewBadge = preview ? (
    <div className="public-knockout-preview-badge">Preview · votes are not recorded</div>
  ) : null;

  const warning = syncWarning ? (
    <div className="public-knockout-sync-warning" role="status">
      {syncWarning}
    </div>
  ) : null;

  if (phase === "result" && state?.championPhotoId) {
    return (
      <>
        {previewBadge}
        {warning}
        <KnockoutReveal
          state={state}
          reveal={reveal}
          revealLoading={revealLoading}
          revealError={revealError}
          championId={state.championPhotoId}
          finalistIds={finalistIds}
          photosById={photosById}
          albumPath={albumPath}
          copied={copied}
          onPlayAgain={handlePlayAgain}
          onCopyLink={handleCopyLink}
          onRetryReveal={() => void loadReveal(state)}
        />
      </>
    );
  }

  if (phase === "revealing" && state && activeMatch && progress) {
    return (
      <>
        {previewBadge}
        {warning}
        <KnockoutArena
          match={activeMatch}
          photosById={photosById}
          albumPath={albumPath}
          roundLabel={knockoutRoundLabel(state)}
          matchNumber={progress.totalMatches}
          totalMatches={progress.totalMatches}
          percent={100}
          canUndo={canUndo}
          crowning
          onPick={() => {}}
          onUndo={handleUndo}
        />
      </>
    );
  }

  if (phase === "playing" && state && currentMatch && progress) {
    return (
      <>
        {previewBadge}
        {warning}
        <KnockoutArena
          match={currentMatch}
          photosById={photosById}
          albumPath={albumPath}
          roundLabel={knockoutRoundLabel(state)}
          matchNumber={progress.matchNumber}
          totalMatches={progress.totalMatches}
          percent={progress.percent}
          canUndo={canUndo}
          crowning={false}
          onPick={handlePick}
          onUndo={handleUndo}
        />
      </>
    );
  }

  if (phase === "intro") {
    return (
      <>
        {previewBadge}
        {warning}
        <KnockoutIntro
          collectionName={deck.collection.name}
          photoCount={deck.photos.length}
          options={options}
          summary={summary}
          savedState={savedState}
          starting={starting}
          onStart={handleStart}
          onResume={handleResume}
          onViewResult={handleResume}
        />
      </>
    );
  }

  return (
    <>
      {previewBadge}
      <main className="public-knockout-error">
        <h1>This bracket took a wrong turn.</h1>
        <p>Your saved picks could not be loaded. Start a fresh knockout to keep going.</p>
        <button type="button" className="public-knockout-button is-primary" onClick={handlePlayAgain}>
          Start over
        </button>
      </main>
    </>
  );
}
