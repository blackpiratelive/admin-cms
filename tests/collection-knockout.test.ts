import { describe, expect, it } from "vitest";
import {
  MIN_CROWD_VOTES,
  allKnockoutPhotoIds,
  buildKnockout,
  computeKnockoutStandings,
  getAlbumPath,
  getCurrentMatch,
  getKnockoutPath,
  hashPhotoPool,
  isKnockoutStateComplete,
  isValidKnockoutState,
  knockoutFinalists,
  knockoutProgress,
  knockoutRoundLabel,
  knockoutSizeOptions,
  pickKnockoutWinner,
  samplePhotoIds,
  seededShuffle,
  selectCrowdChampion,
  type KnockoutStandingPhoto,
  type KnockoutState,
} from "../src/features/libraries/collection-knockout";

function photoIds(count: number, prefix = "photo"): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}_${index + 1}`);
}

function build(count: number, seed = "seed-1", requestedSize: 8 | 16 | "all" = "all") {
  const state = buildKnockout({
    collectionId: "col_test",
    photoIds: photoIds(count),
    seed,
    requestedSize,
    now: "2026-10-20T00:00:00.000Z",
  });
  if (!state) throw new Error("Expected a bracket");
  return state;
}

function playOut(state: KnockoutState, choose: "a" | "b" = "a"): KnockoutState {
  let current = state;
  let guard = 0;
  while (!current.championPhotoId && guard < 200) {
    const match = getCurrentMatch(current);
    if (!match) throw new Error("No current match while playing out");
    const winner = choose === "a" ? match.a : match.b;
    if (!winner) throw new Error("Current match is missing a photo");
    current = pickKnockoutWinner(current, winner, "2026-10-20T00:00:01.000Z");
    guard += 1;
  }
  return current;
}

describe("knockout size options", () => {
  it("returns no options for an album with fewer than two photos", () => {
    expect(knockoutSizeOptions(0)).toEqual([]);
    expect(knockoutSizeOptions(1)).toEqual([]);
  });

  it("offers only the full album when it is smaller than eight photos", () => {
    const options = knockoutSizeOptions(5);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ value: "all", count: 5, label: "All 5 photos" });
  });

  it("dedupes the full album when the album has exactly eight photos", () => {
    const options = knockoutSizeOptions(8);
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ value: 8, count: 8, label: "Quick 8" });
  });

  it("offers 8, 16, and full for larger albums", () => {
    const options = knockoutSizeOptions(20);
    expect(options.map((option) => option.value)).toEqual([8, 16, "all"]);
    expect(options[2]).toMatchObject({ count: 20, label: "Full album" });
  });
});

describe("bracket construction", () => {
  it("builds a two-photo final", () => {
    const state = build(2);
    expect(state.participantCount).toBe(2);
    expect(state.rounds).toHaveLength(1);
    expect(state.rounds[0].matches).toHaveLength(1);
    expect(knockoutRoundLabel(state, 0)).toBe("Final");
    expect(allKnockoutPhotoIds(state)).toHaveLength(2);
  });

  it("handles a three-photo bracket with one bye", () => {
    const state = build(3);
    expect(state.participantCount).toBe(3);
    expect(state.rounds[0].matches).toHaveLength(2);
    expect(knockoutRoundLabel(state, 0)).toBe("Play-in");
    expect(knockoutRoundLabel(state, 1)).toBe("Final");
    const played = playOut(state);
    expect(played.picks).toHaveLength(2);
    expect(played.championPhotoId).toBeTruthy();
    expect(knockoutFinalists(played)).toHaveLength(3);
  });

  it("handles five photos with three byes and exactly four picks", () => {
    const state = build(5);
    expect(state.rounds[0].matches).toHaveLength(4);
    expect(state.rounds).toHaveLength(3);
    const played = playOut(state);
    expect(played.picks).toHaveLength(4);
    expect(isKnockoutStateComplete(played)).toBe(true);
    expect(knockoutFinalists(played)).toHaveLength(4);
  });

  it("builds a clean eight-photo bracket with quarterfinals", () => {
    const state = build(8);
    expect(state.rounds.map((round) => round.matches.length)).toEqual([4, 2, 1]);
    expect(knockoutRoundLabel(state, 0)).toBe("Quarterfinals");
    expect(knockoutRoundLabel(state, 1)).toBe("Semifinals");
    expect(knockoutRoundLabel(state, 2)).toBe("Final");
    const played = playOut(state);
    expect(played.picks).toHaveLength(7);
    expect(knockoutFinalists(played)).toHaveLength(4);
  });

  it("builds a sixteen-photo bracket with a round of 16", () => {
    const state = build(16);
    expect(state.rounds.map((round) => round.matches.length)).toEqual([8, 4, 2, 1]);
    expect(knockoutRoundLabel(state, 0)).toBe("Round of 16");
    expect(playOut(state).picks).toHaveLength(15);
  });

  it("builds a seventeen-photo play-in into a round of 16", () => {
    const state = build(17);
    expect(state.participantCount).toBe(17);
    expect(state.rounds.map((round) => round.matches.length)).toEqual([16, 8, 4, 2, 1]);
    expect(knockoutRoundLabel(state, 0)).toBe("Play-in");
    expect(knockoutRoundLabel(state, 1)).toBe("Round of 16");
    const played = playOut(state);
    expect(played.picks).toHaveLength(16);
    expect(played.championPhotoId).toBeTruthy();
  });

  it("lists every participant exactly once in the opening round", () => {
    for (const count of [2, 3, 4, 5, 7, 8, 9, 16, 17, 31]) {
      const state = build(count);
      const ids = allKnockoutPhotoIds(state);
      expect(new Set(ids).size).toBe(count);
      expect(ids).toHaveLength(count);
      const allRoundZero = state.rounds[0].matches.flatMap((match) =>
        [match.a, match.b].filter(Boolean)
      );
      expect(new Set(allRoundZero).size).toBe(count);
    }
  });

  it("is deterministic for the same seed and different for another seed", () => {
    const first = build(17, "alpha");
    const second = build(17, "alpha");
    const third = build(17, "beta");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(third));
  });
});

describe("sampling", () => {
  it("samples the requested number of photos", () => {
    const ids = photoIds(20);
    const sampled = samplePhotoIds(ids, 8, "sample");
    expect(sampled).toHaveLength(8);
    expect(new Set(sampled).size).toBe(8);
    expect(sampled.every((id) => ids.includes(id))).toBe(true);
    expect(samplePhotoIds(ids, 8, "sample")).toEqual(sampled);
  });

  it("uses every photo for the full-album option", () => {
    const ids = photoIds(13);
    expect(samplePhotoIds(ids, "all", "sample")).toHaveLength(13);
  });

  it("builds a sampled bracket with the requested participant count", () => {
    const state = build(20, "seed-1", 8);
    expect(state.participantCount).toBe(8);
    expect(state.requestedSize).toBe(8);
    expect(playOut(state).picks).toHaveLength(7);
  });
});

describe("pool hashing", () => {
  it("is order independent", () => {
    expect(hashPhotoPool(["c", "a", "b"])).toBe(hashPhotoPool(["a", "b", "c"]));
  });

  it("changes when the pool changes", () => {
    expect(hashPhotoPool(["a", "b", "c"])).not.toBe(hashPhotoPool(["a", "b", "d"]));
  });
});

describe("state validation", () => {
  it("accepts a freshly built state", () => {
    expect(isValidKnockoutState(build(8))).toBe(true);
  });

  it("rejects tampered states", () => {
    const state = build(8);
    expect(isValidKnockoutState({ ...state, version: 99 })).toBe(false);
    expect(isValidKnockoutState({ ...state, currentRound: 99 })).toBe(false);
    expect(
      isValidKnockoutState({
        ...state,
        rounds: [
          {
            matches: [{ a: "x", b: "x", winner: null }],
          },
        ],
      })
    ).toBe(false);
  });
});

describe("progress and paths", () => {
  it("tracks match numbers and percentage", () => {
    const state = build(8);
    const match = getCurrentMatch(state);
    expect(match).not.toBeNull();
    const played = pickKnockoutWinner(state, match!.a as string);
    const progress = knockoutProgress(played);
    expect(progress.totalMatches).toBe(7);
    expect(progress.matchNumber).toBe(2);
    expect(progress.percent).toBe(14);
  });

  it("preserves share tokens and preview flags in paths", () => {
    expect(getKnockoutPath("my-album")).toBe("/collections/my-album/knockout");
    expect(getKnockoutPath("my-album", { token: "abc", preview: true })).toBe(
      "/collections/my-album/knockout?share=abc&preview=1"
    );
    expect(getAlbumPath("my-album", { token: "abc" })).toBe(
      "/collections/my-album?share=abc"
    );
  });

  it("shuffles deterministically", () => {
    const input = photoIds(10);
    expect(seededShuffle(input, "x")).toEqual(seededShuffle(input, "x"));
    expect(seededShuffle(input, "x")).not.toEqual(input);
  });
});

describe("crowd Elo", () => {
  const photos = new Map<string, KnockoutStandingPhoto>(
    photoIds(3).map((id, index) => [
      id,
      {
        id,
        title: `Photo ${index + 1}`,
        mediumUrl: `https://cdn.example/${id}.jpg`,
        thumbnailUrl: `https://cdn.example/${id}-thumb.jpg`,
        camera: "Fujifilm X100V",
      },
    ])
  );

  it("raises the winner and lowers the loser while preserving total rating", () => {
    const votes = Array.from({ length: 10 }, (_, index) => ({
      id: `vote_${index}`,
      winnerPhotoId: "photo_1",
      loserPhotoId: "photo_2",
      createdAt: `2026-10-20T00:00:${String(index).padStart(2, "0")}.000Z`,
    }));
    const standings = computeKnockoutStandings(votes, photos);
    const winner = standings.find((entry) => entry.photoId === "photo_1")!;
    const loser = standings.find((entry) => entry.photoId === "photo_2")!;
    expect(winner.elo).toBeGreaterThan(1500);
    expect(loser.elo).toBeLessThan(1500);
    expect(winner.wins).toBe(10);
    expect(loser.losses).toBe(10);
    expect(winner.matches).toBe(10);
    expect(winner.elo + loser.elo).toBeCloseTo(3000, 1);
    expect(standings[0].photoId).toBe("photo_1");
  });

  it("only surfaces a crowd champion after the vote and match thresholds", () => {
    const votes = Array.from({ length: MIN_CROWD_VOTES }, (_, index) => ({
      id: `vote_${index}`,
      winnerPhotoId: "photo_1",
      loserPhotoId: index % 2 === 0 ? "photo_2" : "photo_3",
      createdAt: `2026-10-20T00:00:${String(index).padStart(2, "0")}.000Z`,
    }));
    const standings = computeKnockoutStandings(votes, photos);
    expect(selectCrowdChampion(standings, MIN_CROWD_VOTES - 1)).toEqual([]);
    const crowd = selectCrowdChampion(standings, MIN_CROWD_VOTES);
    expect(crowd.length).toBeGreaterThan(0);
    expect(crowd.every((entry) => entry.matches >= 3)).toBe(true);
  });
});
