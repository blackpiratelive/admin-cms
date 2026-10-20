/**
 * Best Pic Knockout — pure tournament engine.
 *
 * No database, React, or browser APIs live here. Everything is deterministic
 * for a given seed so a bracket can be rebuilt/resumed from localStorage and
 * tested in isolation.
 */

export const KNOCKOUT_STATE_VERSION = 1 as const;
export const KNOCKOUT_ELO_START = 1500;
export const KNOCKOUT_ELO_K = 32;
export const MIN_CROWD_VOTES = 10;
export const MIN_PHOTO_MATCHES = 3;
export const CROWD_LIMIT = 3;

export type KnockoutRequestedSize = 8 | 16 | "all";

export interface KnockoutMatch {
  a: string | null;
  b: string | null;
  winner: string | null;
}

export interface KnockoutRound {
  matches: KnockoutMatch[];
}

export interface KnockoutPick {
  round: number;
  matchIndex: number;
  winnerId: string;
  loserId: string;
  at: string;
}

export interface KnockoutState {
  version: typeof KNOCKOUT_STATE_VERSION;
  collectionId: string;
  poolHash: string;
  seed: string;
  requestedSize: KnockoutRequestedSize;
  participantCount: number;
  rounds: KnockoutRound[];
  currentRound: number;
  currentMatch: number;
  championPhotoId: string | null;
  picks: KnockoutPick[];
  startedAt: string;
  completedAt: string | null;
}

export interface KnockoutSizeOption {
  value: KnockoutRequestedSize;
  label: string;
  count: number;
  minutes: number;
}

export interface KnockoutVoteLike {
  id?: string;
  winnerPhotoId: string;
  loserPhotoId: string;
  createdAt: string;
}

export interface KnockoutStandingPhoto {
  id: string;
  title: string;
  mediumUrl: string;
  thumbnailUrl: string;
  camera?: string | null;
}

export interface KnockoutStanding {
  photoId: string;
  title: string;
  mediumUrl: string;
  thumbnailUrl: string;
  camera: string | null;
  elo: number;
  wins: number;
  losses: number;
  matches: number;
}

// ---------------------------------------------------------------------------
// Deterministic hashing / randomness
// ---------------------------------------------------------------------------

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic 64-bit-ish hex hash used to fingerprint a photo pool. */
export function hashPhotoPool(photoIds: string[]): string {
  const canonical = Array.from(new Set(photoIds)).sort().join("|");
  const first = hashString(`pool:${canonical}`).toString(16).padStart(8, "0");
  const second = hashString(`salt:${canonical}`).toString(16).padStart(8, "0");
  return `${first}${second}`;
}

/** Mulberry32 seeded PRNG. */
export function createSeededRandom(seed: string): () => number {
  let state = hashString(seed) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const randomized = [...items];
  const random = createSeededRandom(seed);
  for (let i = randomized.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
  }
  return randomized;
}

export function samplePhotoIds(
  photoIds: string[],
  requestedSize: KnockoutRequestedSize,
  seed: string
): string[] {
  const unique = Array.from(new Set(photoIds.filter(Boolean))).sort();
  if (requestedSize !== "all" && requestedSize < unique.length) {
    return seededShuffle(unique, `${seed}:sample`).slice(0, requestedSize);
  }
  return seededShuffle(unique, `${seed}:sample`);
}

export function nextPowerOfTwo(value: number): number {
  if (value <= 1) return 1;
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function knockoutSizeOptions(photoCount: number): KnockoutSizeOption[] {
  if (photoCount < 2) return [];

  const candidates: KnockoutRequestedSize[] = [];
  if (photoCount >= 8) candidates.push(8);
  if (photoCount >= 16) candidates.push(16);
  candidates.push("all");

  const seen = new Set<number>();
  const options: KnockoutSizeOption[] = [];
  for (const value of candidates) {
    const count = value === "all" ? photoCount : value;
    if (seen.has(count)) continue;
    seen.add(count);
    const label =
      value === "all"
        ? photoCount <= 8
          ? `All ${photoCount} photos`
          : "Full album"
        : value === 8
          ? "Quick 8"
          : "Classic 16";
    const minutes = Math.max(1, Math.ceil(((count - 1) * 8) / 60));
    options.push({ value, label, count, minutes });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Bracket construction
// ---------------------------------------------------------------------------

export interface BuildKnockoutInput {
  collectionId: string;
  photoIds: string[];
  seed: string;
  requestedSize: KnockoutRequestedSize;
  poolHash?: string;
  now?: string;
}

function emptyMatch(): KnockoutMatch {
  return { a: null, b: null, winner: null };
}

function emptyRound(matchCount: number): KnockoutRound {
  return { matches: Array.from({ length: matchCount }, emptyMatch) };
}

function placeWinner(
  rounds: KnockoutRound[],
  roundIndex: number,
  matchIndex: number,
  winnerId: string
) {
  const nextRound = rounds[roundIndex + 1];
  if (!nextRound) return;
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const side = matchIndex % 2 === 0 ? "a" : "b";
  const target = nextRound.matches[nextMatchIndex];
  if (!target) return;
  target[side] = winnerId;
}

function firstPlayableMatch(
  rounds: KnockoutRound[],
  startRound = 0
): { round: number; matchIndex: number } | null {
  for (let roundIndex = startRound; roundIndex < rounds.length; roundIndex += 1) {
    const round = rounds[roundIndex];
    for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex += 1) {
      const match = round.matches[matchIndex];
      if (!match.winner && match.a && match.b) {
        return { round: roundIndex, matchIndex };
      }
    }
  }
  return null;
}

export function buildKnockout(input: BuildKnockoutInput): KnockoutState | null {
  const participants = samplePhotoIds(input.photoIds, input.requestedSize, input.seed);
  if (participants.length < 2) return null;

  const bracketSize = nextPowerOfTwo(participants.length);
  const firstRoundMatchCount = bracketSize / 2;
  const byeCount = bracketSize - participants.length;
  const poolHash = input.poolHash || hashPhotoPool(input.photoIds);
  const now = input.now || new Date().toISOString();

  const random = createSeededRandom(`${input.seed}:byes`);
  const byeIndexes = new Set<number>();
  while (byeIndexes.size < byeCount) {
    byeIndexes.add(Math.floor(random() * firstRoundMatchCount));
  }

  const shuffled = seededShuffle(participants, `${input.seed}:order`);
  const rounds: KnockoutRound[] = [];
  for (let count = firstRoundMatchCount; count >= 1; count = Math.floor(count / 2)) {
    rounds.push(emptyRound(count));
  }

  let cursor = 0;
  const firstRound = rounds[0];
  for (let matchIndex = 0; matchIndex < firstRound.matches.length; matchIndex += 1) {
    const match = firstRound.matches[matchIndex];
    const photoA = shuffled[cursor++] ?? null;
    if (byeIndexes.has(matchIndex)) {
      const byeFirst = createSeededRandom(`${input.seed}:side:${matchIndex}`)() < 0.5;
      if (byeFirst) {
        match.a = photoA;
      } else {
        match.b = photoA;
      }
      match.winner = photoA;
      placeWinner(rounds, 0, matchIndex, photoA as string);
    } else {
      const photoB = shuffled[cursor++] ?? null;
      match.a = photoA;
      match.b = photoB;
    }
  }

  const current = firstPlayableMatch(rounds, 0);
  if (!current) return null;

  return {
    version: KNOCKOUT_STATE_VERSION,
    collectionId: input.collectionId,
    poolHash,
    seed: input.seed,
    requestedSize: input.requestedSize,
    participantCount: participants.length,
    rounds,
    currentRound: current.round,
    currentMatch: current.matchIndex,
    championPhotoId: null,
    picks: [],
    startedAt: now,
    completedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Bracket progression
// ---------------------------------------------------------------------------

export function getCurrentMatch(state: KnockoutState): KnockoutMatch | null {
  if (state.championPhotoId) return null;
  const match = state.rounds[state.currentRound]?.matches[state.currentMatch];
  if (!match || match.winner || !match.a || !match.b) return null;
  return match;
}

export function totalKnockoutMatches(state: KnockoutState): number {
  return Math.max(0, state.participantCount - 1);
}

export function knockoutProgress(state: KnockoutState): {
  matchNumber: number;
  totalMatches: number;
  percent: number;
} {
  const totalMatches = totalKnockoutMatches(state);
  const matchNumber = Math.min(totalMatches, state.picks.length + 1);
  const percent = totalMatches > 0 ? Math.round((state.picks.length / totalMatches) * 100) : 0;
  return { matchNumber, totalMatches, percent };
}

export function pickKnockoutWinner(
  state: KnockoutState,
  photoId: string,
  now = new Date().toISOString()
): KnockoutState {
  if (state.championPhotoId) return state;
  const match = getCurrentMatch(state);
  if (!match || (match.a !== photoId && match.b !== photoId)) return state;

  const loserId = match.a === photoId ? match.b : match.a;
  if (!loserId) return state;

  const rounds: KnockoutRound[] = state.rounds.map((round) => ({
    matches: round.matches.map((entry) => ({ ...entry })),
  }));
  const target = rounds[state.currentRound].matches[state.currentMatch];
  target.winner = photoId;
  placeWinner(rounds, state.currentRound, state.currentMatch, photoId);

  const picks: KnockoutPick[] = [
    ...state.picks,
    {
      round: state.currentRound,
      matchIndex: state.currentMatch,
      winnerId: photoId,
      loserId,
      at: now,
    },
  ];

  const next = firstPlayableMatch(rounds, state.currentRound);
  if (next) {
    return {
      ...state,
      rounds,
      picks,
      currentRound: next.round,
      currentMatch: next.matchIndex,
    };
  }

  const finalRound = rounds[rounds.length - 1];
  const champion = finalRound?.matches[0]?.winner || null;
  return {
    ...state,
    rounds,
    picks,
    championPhotoId: champion,
    completedAt: champion ? now : null,
  };
}

export function hasByes(state: KnockoutState): boolean {
  return state.rounds[0]?.matches.some((match) => !match.a || !match.b) ?? false;
}

export function knockoutRoundLabel(state: KnockoutState, roundIndex = state.currentRound): string {
  if (roundIndex === 0 && hasByes(state)) return "Play-in";
  const matchCount = state.rounds[roundIndex]?.matches.length ?? 0;
  switch (matchCount) {
    case 1:
      return "Final";
    case 2:
      return "Semifinals";
    case 4:
      return "Quarterfinals";
    case 8:
      return "Round of 16";
    case 16:
      return "Round of 32";
    case 32:
      return "Round of 64";
    default:
      return `Round ${roundIndex + 1}`;
  }
}

function uniqueParticipants(matches: KnockoutMatch[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    for (const id of [match.a, match.b]) {
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** The four photos that reached the semifinals (or all finalists for tiny albums). */
export function knockoutFinalists(state: KnockoutState): string[] {
  const semifinalRound = state.rounds.find((round) => round.matches.length === 2);
  if (semifinalRound) return uniqueParticipants(semifinalRound.matches).slice(0, 4);
  return uniqueParticipants(state.rounds[0]?.matches ?? []).slice(0, 4);
}

export function allKnockoutPhotoIds(state: KnockoutState): string[] {
  return uniqueParticipants(state.rounds[0]?.matches ?? []);
}

export function isKnockoutStateComplete(state: KnockoutState): boolean {
  return Boolean(state.championPhotoId && state.completedAt);
}

export function isValidKnockoutState(value: unknown): value is KnockoutState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<KnockoutState>;
  if (state.version !== KNOCKOUT_STATE_VERSION) return false;
  if (typeof state.collectionId !== "string" || !state.collectionId) return false;
  if (typeof state.poolHash !== "string" || !state.poolHash) return false;
  if (typeof state.seed !== "string" || !state.seed) return false;
  if (state.requestedSize !== 8 && state.requestedSize !== 16 && state.requestedSize !== "all") {
    return false;
  }
  if (typeof state.participantCount !== "number" || state.participantCount < 2) return false;
  if (!Array.isArray(state.rounds) || state.rounds.length === 0) return false;
  if (!Array.isArray(state.picks)) return false;
  if (typeof state.startedAt !== "string") return false;

  for (const round of state.rounds) {
    if (!round || !Array.isArray(round.matches) || round.matches.length === 0) return false;
    for (const match of round.matches) {
      if (!match || typeof match !== "object") return false;
      const { a, b, winner } = match;
      if (a !== null && typeof a !== "string") return false;
      if (b !== null && typeof b !== "string") return false;
      if (winner !== null && typeof winner !== "string") return false;
      if (a && b && a === b) return false;
    }
  }

  if (
    typeof state.currentRound !== "number" ||
    state.currentRound < 0 ||
    state.currentRound >= state.rounds.length
  ) {
    return false;
  }
  if (typeof state.currentMatch !== "number" || state.currentMatch < 0) return false;
  if (state.currentMatch >= (state.rounds[state.currentRound]?.matches.length ?? 0)) {
    return false;
  }
  if (state.championPhotoId !== null && typeof state.championPhotoId !== "string") return false;
  if (state.completedAt !== null && typeof state.completedAt !== "string") return false;
  return true;
}

// ---------------------------------------------------------------------------
// Crowd Elo
// ---------------------------------------------------------------------------

export function computeKnockoutStandings(
  votes: KnockoutVoteLike[],
  photos: Map<string, KnockoutStandingPhoto>
): KnockoutStanding[] {
  const ratings = new Map<string, number>();
  const wins = new Map<string, number>();
  const losses = new Map<string, number>();
  const matches = new Map<string, number>();

  const ensure = (photoId: string) => {
    if (!ratings.has(photoId)) ratings.set(photoId, KNOCKOUT_ELO_START);
    if (!wins.has(photoId)) wins.set(photoId, 0);
    if (!losses.has(photoId)) losses.set(photoId, 0);
    if (!matches.has(photoId)) matches.set(photoId, 0);
  };

  const ordered = [...votes].sort((a, b) => {
    const byDate = a.createdAt.localeCompare(b.createdAt);
    if (byDate !== 0) return byDate;
    return (a.id || "").localeCompare(b.id || "");
  });

  for (const vote of ordered) {
    if (!vote.winnerPhotoId || !vote.loserPhotoId) continue;
    if (vote.winnerPhotoId === vote.loserPhotoId) continue;
    ensure(vote.winnerPhotoId);
    ensure(vote.loserPhotoId);

    const winnerRating = ratings.get(vote.winnerPhotoId) as number;
    const loserRating = ratings.get(vote.loserPhotoId) as number;
    const expectedWinner = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
    const delta = KNOCKOUT_ELO_K * (1 - expectedWinner);

    ratings.set(vote.winnerPhotoId, winnerRating + delta);
    ratings.set(vote.loserPhotoId, loserRating - delta);
    wins.set(vote.winnerPhotoId, (wins.get(vote.winnerPhotoId) || 0) + 1);
    losses.set(vote.loserPhotoId, (losses.get(vote.loserPhotoId) || 0) + 1);
    matches.set(vote.winnerPhotoId, (matches.get(vote.winnerPhotoId) || 0) + 1);
    matches.set(vote.loserPhotoId, (matches.get(vote.loserPhotoId) || 0) + 1);
  }

  const standings: KnockoutStanding[] = [];
  for (const [photoId, elo] of ratings.entries()) {
    const photo = photos.get(photoId);
    if (!photo) continue;
    standings.push({
      photoId,
      title: photo.title,
      mediumUrl: photo.mediumUrl,
      thumbnailUrl: photo.thumbnailUrl,
      camera: photo.camera || null,
      elo: Math.round(elo * 10) / 10,
      wins: wins.get(photoId) || 0,
      losses: losses.get(photoId) || 0,
      matches: matches.get(photoId) || 0,
    });
  }

  return standings.sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.matches !== a.matches) return b.matches - a.matches;
    return a.photoId.localeCompare(b.photoId);
  });
}

export function selectCrowdChampion(
  standings: KnockoutStanding[],
  totalVotes: number,
  limit = CROWD_LIMIT
): KnockoutStanding[] {
  if (totalVotes < MIN_CROWD_VOTES) return [];
  return standings.filter((entry) => entry.matches >= MIN_PHOTO_MATCHES).slice(0, limit);
}

export function hasCrowdChampion(totalVotes: number, standings: KnockoutStanding[]): boolean {
  return selectCrowdChampion(standings, totalVotes).length > 0;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function getKnockoutPath(
  slug: string,
  options: { token?: string | null; preview?: boolean } = {}
): string {
  const params = new URLSearchParams();
  if (options.token) params.set("share", options.token);
  if (options.preview) params.set("preview", "1");
  const query = params.toString();
  return `/collections/${slug}/knockout${query ? `?${query}` : ""}`;
}

export function getAlbumPath(
  slug: string,
  options: { token?: string | null; preview?: boolean } = {}
): string {
  const params = new URLSearchParams();
  if (options.token) params.set("share", options.token);
  if (options.preview) params.set("preview", "1");
  const query = params.toString();
  return `/collections/${slug}${query ? `?${query}` : ""}`;
}
