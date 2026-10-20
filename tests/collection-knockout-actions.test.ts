import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, ensureDbInitialized } from "../src/db";
import {
  collectionAnalytics,
  collectionItems,
  collectionKnockoutRuns,
  collectionKnockoutVotes,
  collections,
  gallery,
} from "../src/db/schema";
import {
  addPhotosToCollectionAction,
  createCollectionAction,
  deleteCollectionAction,
  removeItemFromCollectionAction,
  setCollectionVisibilityAction,
} from "../src/features/libraries/actions/collections";
import {
  completeCollectionKnockoutAction,
  getCollectionKnockoutAdminStatsAction,
  getCollectionKnockoutDeckAction,
  getCollectionKnockoutRevealAction,
  getCollectionKnockoutSummaryAction,
  recordCollectionKnockoutVoteAction,
  resetCollectionKnockoutAction,
  setCollectionKnockoutEnabledAction,
  startCollectionKnockoutAction,
} from "../src/features/libraries/actions/collection-knockout";
import { hashPhotoPool } from "../src/features/libraries/collection-knockout";
import { knockoutImagePath } from "../src/features/libraries/knockout-images";
import { deleteGalleryPhoto } from "../src/features/gallery/actions";

const run = `knockout_${Date.now().toString(36)}`;
const publicPhotoIds = Array.from({ length: 10 }, (_, index) => `${run}_public_${index + 1}`);
const unlistedPhotoId = `${run}_unlisted`;
const privatePhotoId = `${run}_private`;
const extraPhotoId = `${run}_extra`;
const disposablePhotoId = `${run}_disposable`;
const allPhotoIds = [
  ...publicPhotoIds,
  unlistedPhotoId,
  privatePhotoId,
  extraPhotoId,
  disposablePhotoId,
];
const now = new Date().toISOString();
const sessionOne = `${run}_session_one`;
const sessionTwo = `${run}_session_two`;
const collectionIds: string[] = [];

function requireId(result: { success: boolean; id?: string; slug?: string }): {
  id: string;
  slug: string;
} {
  expect(result.success).toBe(true);
  if (!result.id || !result.slug) throw new Error("Collection creation failed");
  collectionIds.push(result.id);
  return { id: result.id, slug: result.slug };
}

async function createAlbum(name: string, kind: "photo" | "media" = "photo") {
  return requireId(
    await createCollectionAction(`${run} ${name}`, "Knockout test album", "#ff6600", "Trophy", kind)
  );
}

function photoRecord(
  id: string,
  index: number,
  visibility: "public" | "private" | "unlisted" = "public"
) {
  return {
    id,
    title: `Photo ${index} ${id.slice(-4)}`,
    slug: `${id}-slug`,
    description: `Description for ${id}`,
    originalUrl: `https://originals.example/${id}.jpg`,
    largeUrl: `https://cdn.example/${id}-large.jpg`,
    mediumUrl: `https://cdn.example/${id}-medium.jpg`,
    thumbnailUrl: `https://cdn.example/${id}-thumb.jpg`,
    width: 4000,
    height: 3000,
    camera: "Fujifilm X100V",
    lens: "23mm f/2",
    focalLength: "23mm",
    aperture: "f/2.0",
    shutterSpeed: "1/250",
    iso: 160,
    takenAt: `2024-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    locationName: "Zermatt",
    visibility,
    createdAt: `2024-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    updatedAt: now,
  };
}

async function requireDeck(key: string, token?: string) {
  const result = await getCollectionKnockoutDeckAction(key, token);
  if (!result || result.state !== "ready") throw new Error("Expected a knockout deck");
  return result.deck;
}

async function voteCount(collectionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionKnockoutVotes)
    .where(eq(collectionKnockoutVotes.collectionId, collectionId));
  return Number(rows[0]?.count || 0);
}

async function runCount(collectionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionKnockoutRuns)
    .where(eq(collectionKnockoutRuns.collectionId, collectionId));
  return Number(rows[0]?.count || 0);
}

function voteInput(
  album: { slug: string },
  poolHash: string,
  winnerPhotoId: string,
  loserPhotoId: string,
  round = 0,
  matchIndex = 0,
  sessionId = sessionOne,
  seed = `${run}_seed`
) {
  return {
    slug: album.slug,
    token: null,
    sessionId,
    seed,
    poolHash,
    round,
    matchIndex,
    winnerPhotoId,
    loserPhotoId,
    preview: false,
  };
}

function startInput(
  album: { slug: string },
  poolHash: string,
  sessionId = sessionOne,
  seed = `${run}_seed`,
  requestedSize: 8 | 16 | "all" = "all",
  bracketSize = 16
) {
  return {
    slug: album.slug,
    token: null,
    sessionId,
    seed,
    poolHash,
    requestedSize,
    bracketSize,
    preview: false,
  };
}

function completeInput(
  album: { slug: string },
  poolHash: string,
  championPhotoId: string,
  sessionId = sessionOne,
  seed = `${run}_seed`,
  bracketSize = 16
) {
  return {
    slug: album.slug,
    token: null,
    sessionId,
    seed,
    poolHash,
    bracketSize,
    championPhotoId,
    matchesPlayed: Math.max(1, bracketSize - 1),
    preview: false,
  };
}

describe("Best Pic Knockout actions", () => {
  let photoAlbum: { id: string; slug: string };
  let privateAlbum: { id: string; slug: string };
  let unlistedAlbum: { id: string; slug: string };
  let mediaAlbum: { id: string; slug: string };
  let emptyAlbum: { id: string; slug: string };
  let toggleAlbum: { id: string; slug: string };
  let cleanupAlbum: { id: string; slug: string };
  let galleryAlbum: { id: string; slug: string };
  let deleteAlbum: { id: string; slug: string };
  let unlistedToken = "";

  beforeAll(async () => {
    await ensureDbInitialized();

    await db
      .insert(gallery)
      .values([
        ...publicPhotoIds.map((id, index) => photoRecord(id, index + 1, "public")),
        photoRecord(unlistedPhotoId, 11, "unlisted"),
        photoRecord(privatePhotoId, 12, "private"),
        photoRecord(extraPhotoId, 13, "public"),
        photoRecord(disposablePhotoId, 14, "public"),
      ])
      .onConflictDoNothing();

    photoAlbum = await createAlbum("Main Photo Album");
    privateAlbum = await createAlbum("Private Photo Album");
    unlistedAlbum = await createAlbum("Unlisted Photo Album");
    mediaAlbum = await createAlbum("Media Album", "media");
    emptyAlbum = await createAlbum("Empty Photo Album");
    toggleAlbum = await createAlbum("Toggle Photo Album");
    cleanupAlbum = await createAlbum("Cleanup Photo Album");
    galleryAlbum = await createAlbum("Gallery Cleanup Album");
    deleteAlbum = await createAlbum("Delete Cleanup Album");

    await addPhotosToCollectionAction(photoAlbum.id, [
      ...publicPhotoIds,
      unlistedPhotoId,
      privatePhotoId,
    ]);
    await addPhotosToCollectionAction(privateAlbum.id, [publicPhotoIds[0], publicPhotoIds[1]]);
    await addPhotosToCollectionAction(unlistedAlbum.id, [publicPhotoIds[0], publicPhotoIds[1]]);
    await addPhotosToCollectionAction(toggleAlbum.id, [publicPhotoIds[2], publicPhotoIds[3]]);
    await addPhotosToCollectionAction(cleanupAlbum.id, [
      extraPhotoId,
      unlistedPhotoId,
      publicPhotoIds[0],
    ]);
    await addPhotosToCollectionAction(galleryAlbum.id, [
      disposablePhotoId,
      extraPhotoId,
      publicPhotoIds[1],
    ]);
    await addPhotosToCollectionAction(deleteAlbum.id, [extraPhotoId, unlistedPhotoId]);

    await setCollectionVisibilityAction(photoAlbum.id, "public");
    await setCollectionVisibilityAction(mediaAlbum.id, "public");
    await setCollectionVisibilityAction(emptyAlbum.id, "public");
    await setCollectionVisibilityAction(toggleAlbum.id, "public");
    await setCollectionVisibilityAction(cleanupAlbum.id, "public");
    await setCollectionVisibilityAction(galleryAlbum.id, "public");
    await setCollectionVisibilityAction(deleteAlbum.id, "public");

    const unlistedResult = await setCollectionVisibilityAction(unlistedAlbum.id, "unlisted");
    const sharePath = "sharePath" in unlistedResult ? unlistedResult.sharePath : null;
    if (!sharePath) throw new Error("Expected an unlisted share path");
    unlistedToken = new URL(sharePath, "https://example.com").searchParams.get("share") || "";
    expect(unlistedToken).toBeTruthy();
  });

  beforeEach(async () => {
    await db
      .delete(collectionKnockoutVotes)
      .where(eq(collectionKnockoutVotes.collectionId, photoAlbum.id));
    await db
      .delete(collectionKnockoutRuns)
      .where(eq(collectionKnockoutRuns.collectionId, photoAlbum.id));
  });

  afterAll(async () => {
    if (collectionIds.length > 0) {
      await db
        .delete(collectionKnockoutVotes)
        .where(inArray(collectionKnockoutVotes.collectionId, collectionIds));
      await db
        .delete(collectionKnockoutRuns)
        .where(inArray(collectionKnockoutRuns.collectionId, collectionIds));
      await db
        .delete(collectionItems)
        .where(inArray(collectionItems.collectionId, collectionIds));
      await db
        .delete(collectionAnalytics)
        .where(inArray(collectionAnalytics.collectionId, collectionIds));
      await db.delete(collections).where(inArray(collections.id, collectionIds));
    }
    await db.delete(gallery).where(inArray(gallery.id, allPhotoIds));
  });

  it("serves a blind deck with only the visible photos", async () => {
    const deck = await requireDeck(photoAlbum.slug);
    expect(deck.collection.id).toBe(photoAlbum.id);
    expect(deck.photos).toHaveLength(11);
    expect(deck.photos.map((photo) => photo.id)).not.toContain(privatePhotoId);
    expect(deck.photos.map((photo) => photo.id)).toContain(unlistedPhotoId);

    for (const photo of deck.photos) {
      expect(Object.keys(photo).sort()).toEqual(
        ["height", "id", "largeUrl", "mediumUrl", "thumbnailUrl", "width"].sort()
      );
      expect(photo).not.toHaveProperty("title");
      expect(photo).not.toHaveProperty("camera");
      expect(photo).not.toHaveProperty("takenAt");
      expect(photo).not.toHaveProperty("locationName");
      expect(photo).not.toHaveProperty("originalUrl");
      expect(photo.largeUrl).toMatch(/^\/api\/gallery\/knockout-image\?/);
      expect(photo.mediumUrl).toMatch(/^\/api\/gallery\/knockout-image\?/);
      expect(photo.thumbnailUrl).toMatch(/^\/api\/gallery\/knockout-image\?/);
      expect(photo.largeUrl).not.toContain("cdn.example");
      expect(photo.mediumUrl).not.toContain("cdn.example");
      expect(photo.thumbnailUrl).not.toContain("cdn.example");
    }
    expect(JSON.stringify(deck)).not.toContain("Fujifilm");
    expect(JSON.stringify(deck)).not.toContain("Zermatt");
    expect(JSON.stringify(deck)).not.toContain("cdn.example");
    expect(JSON.stringify(deck)).not.toContain("2024-01");

    const summary = await getCollectionKnockoutSummaryAction(photoAlbum.slug);
    expect(summary).toMatchObject({
      completedRuns: 0,
      totalVotes: 0,
      crowdReady: false,
    });
  });

  it("serves blind images only through signed opaque proxy URLs", async () => {
    const deck = await requireDeck(photoAlbum.slug);
    const photo = deck.photos[0];
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "image/webp" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const { GET } = await import("../src/app/api/gallery/knockout-image/route");
      const response = await GET(
        new NextRequest(`https://example.com${photo.mediumUrl}`)
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/cdn\.example\/.+-medium\.jpg$/),
        expect.objectContaining({ cache: "no-store" })
      );

      const tampered = photo.mediumUrl.replace(/photo=[^&]+/, "photo=someone-else");
      const denied = await GET(new NextRequest(`https://example.com${tampered}`));
      expect(denied.status).toBe(404);

      const privateUrl = knockoutImagePath(
        photoAlbum.id,
        privatePhotoId,
        "medium"
      );
      const privateDenied = await GET(
        new NextRequest(`https://example.com${privateUrl}`)
      );
      expect(privateDenied.status).toBe(404);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("blocks private, media, and too-small collections", async () => {
    expect(await getCollectionKnockoutDeckAction(privateAlbum.slug)).toBeNull();
    expect(await getCollectionKnockoutSummaryAction(privateAlbum.slug)).toBeNull();

    expect(await getCollectionKnockoutDeckAction(mediaAlbum.slug)).toEqual({
      state: "disabled",
    });
    expect(await getCollectionKnockoutDeckAction(emptyAlbum.slug)).toEqual({
      state: "disabled",
    });

    const deck = await requireDeck(photoAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const result = await startCollectionKnockoutAction({
      ...startInput(photoAlbum, poolHash),
      slug: privateAlbum.slug,
    });
    expect(result.success).toBe(false);
  });

  it("requires the share token for unlisted albums", async () => {
    expect(await getCollectionKnockoutDeckAction(unlistedAlbum.slug)).toBeNull();
    const deck = await requireDeck(unlistedAlbum.slug, unlistedToken);
    expect(deck.photos).toHaveLength(2);

    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const missingToken = await startCollectionKnockoutAction(
      startInput(unlistedAlbum, poolHash, sessionOne, `${run}_seed`, "all", 2)
    );
    expect(missingToken.success).toBe(false);

    const withToken = await startCollectionKnockoutAction({
      ...startInput(unlistedAlbum, poolHash, sessionOne, `${run}_seed`, "all", 2),
      token: unlistedToken,
    });
    expect(withToken).toMatchObject({ success: true, recorded: true });

    const wrongToken = await startCollectionKnockoutAction({
      ...startInput(unlistedAlbum, poolHash, sessionOne, `${run}_seed`, "all", 2),
      token: `${unlistedToken}x`,
    });
    expect(wrongToken.success).toBe(false);
  });

  it("toggles the knockout without deleting its data", async () => {
    const deck = await requireDeck(toggleAlbum.slug);
    expect(deck.photos).toHaveLength(2);

    const off = await setCollectionKnockoutEnabledAction(toggleAlbum.id, false);
    expect(off.success).toBe(true);
    expect(await getCollectionKnockoutDeckAction(toggleAlbum.slug)).toEqual({
      state: "disabled",
    });
    expect(await getCollectionKnockoutSummaryAction(toggleAlbum.slug)).toBeNull();

    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const start = await startCollectionKnockoutAction(startInput(toggleAlbum, poolHash));
    expect(start.success).toBe(false);

    const on = await setCollectionKnockoutEnabledAction(toggleAlbum.id, true);
    expect(on.success).toBe(true);
    expect((await requireDeck(toggleAlbum.slug)).photos).toHaveLength(2);
  });

  it("records idempotent votes, completes a run, and reveals metadata", async () => {
    const deck = await requireDeck(photoAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const [winner, loser] = deck.photos.map((photo) => photo.id);

    const start = await startCollectionKnockoutAction({
      ...startInput(photoAlbum, poolHash),
      seed: `${run}_flow`,
    });
    expect(start).toMatchObject({ success: true, recorded: true });

    const duplicateStart = await startCollectionKnockoutAction({
      ...startInput(photoAlbum, poolHash),
      seed: `${run}_flow`,
    });
    expect(duplicateStart).toMatchObject({ success: true, recorded: true });
    expect(await runCount(photoAlbum.id)).toBe(1);

    const mismatchedBracket = await startCollectionKnockoutAction({
      ...startInput(photoAlbum, poolHash),
      seed: `${run}_mismatch`,
      bracketSize: 8,
    });
    expect(mismatchedBracket.success).toBe(false);

    const validVote = voteInput(
      photoAlbum,
      poolHash,
      winner,
      loser,
      0,
      0,
      sessionOne,
      `${run}_flow`
    );
    expect(await recordCollectionKnockoutVoteAction(validVote)).toMatchObject({
      success: true,
      recorded: true,
    });
    expect(await recordCollectionKnockoutVoteAction(validVote)).toMatchObject({
      success: true,
      recorded: true,
    });
    expect(await voteCount(photoAlbum.id)).toBe(1);

    expect(
      await recordCollectionKnockoutVoteAction({
        ...validVote,
        loserPhotoId: winner,
      })
    ).toMatchObject({ success: false });
    expect(
      await recordCollectionKnockoutVoteAction({
        ...validVote,
        loserPhotoId: extraPhotoId,
        round: 1,
      })
    ).toMatchObject({ success: false });
    expect(
      await recordCollectionKnockoutVoteAction({
        ...validVote,
        loserPhotoId: privatePhotoId,
        round: 2,
      })
    ).toMatchObject({ success: false });
    expect(
      await recordCollectionKnockoutVoteAction({
        ...validVote,
        round: 3,
        preview: true,
      })
    ).toMatchObject({ success: true, recorded: false });
    expect(await voteCount(photoAlbum.id)).toBe(1);

    const complete = await completeCollectionKnockoutAction({
      ...completeInput(photoAlbum, poolHash, winner, sessionOne, `${run}_flow`),
    });
    expect(complete).toMatchObject({ success: true, recorded: true });

    const runs = await db
      .select()
      .from(collectionKnockoutRuns)
      .where(eq(collectionKnockoutRuns.collectionId, photoAlbum.id));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: "completed",
      championPhotoId: winner,
      matchesPlayed: 15,
    });

    const reveal = await getCollectionKnockoutRevealAction({
      slug: photoAlbum.slug,
      token: null,
      photoIds: [winner, loser],
    });
    expect(reveal).not.toBeNull();
    expect(reveal?.photos).toHaveLength(2);
    const revealedWinner = reveal?.photos.find((photo) => photo.id === winner);
    expect(revealedWinner?.title).toBeTruthy();
    expect(revealedWinner?.camera).toBe("Fujifilm X100V");
    expect(revealedWinner?.locationName).toBe("Zermatt");
    expect(reveal?.crowd.totalVotes).toBe(1);
    expect(reveal?.crowd.ready).toBe(false);
    expect(reveal?.crowd.standings).toEqual([]);

    const stats = await getCollectionKnockoutAdminStatsAction(photoAlbum.id);
    expect(stats).toMatchObject({
      enabled: true,
      eligible: true,
      startedRuns: 1,
      completedRuns: 1,
      completionRate: 100,
      totalVotes: 1,
      uniqueSessions: 1,
      crowdReady: false,
    });
    expect(stats?.lastVoteAt).toBeTruthy();
    expect(stats?.standings[0]).toMatchObject({
      photoId: winner,
      wins: 1,
      losses: 0,
      matches: 1,
    });

    const summary = await getCollectionKnockoutSummaryAction(photoAlbum.slug);
    expect(summary).toMatchObject({ completedRuns: 1, totalVotes: 1, crowdReady: false });
  });

  it("reveals the crowd only after ten votes and three matchups per photo", async () => {
    const deck = await requireDeck(photoAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const [first, second, third, fourth] = deck.photos.map((photo) => photo.id);

    for (let index = 0; index < 9; index += 1) {
      const result = await recordCollectionKnockoutVoteAction(
        voteInput(
          photoAlbum,
          poolHash,
          first,
          index % 2 === 0 ? second : third,
          index,
          0,
          sessionOne,
          `${run}_crowd`
        )
      );
      expect(result.success).toBe(true);
    }
    expect(await voteCount(photoAlbum.id)).toBe(9);
    expect((await getCollectionKnockoutSummaryAction(photoAlbum.slug))?.crowdReady).toBe(false);

    await recordCollectionKnockoutVoteAction(
      voteInput(photoAlbum, poolHash, first, second, 9, 0, sessionOne, `${run}_crowd`)
    );
    expect(await voteCount(photoAlbum.id)).toBe(10);
    expect((await getCollectionKnockoutSummaryAction(photoAlbum.slug))?.crowdReady).toBe(true);

    await recordCollectionKnockoutVoteAction(
      voteInput(photoAlbum, poolHash, fourth, second, 10, 0, sessionTwo, `${run}_crowd`)
    );
    await recordCollectionKnockoutVoteAction(
      voteInput(photoAlbum, poolHash, fourth, third, 11, 0, sessionTwo, `${run}_crowd`)
    );

    const reveal = await getCollectionKnockoutRevealAction({
      slug: photoAlbum.slug,
      token: null,
      photoIds: [first, second, third, fourth],
    });
    expect(reveal?.crowd.totalVotes).toBe(12);
    expect(reveal?.crowd.ready).toBe(true);
    expect(reveal?.crowd.standings).toHaveLength(3);
    expect(reveal?.crowd.standings.every((entry) => entry.matches >= 3)).toBe(true);
    expect(reveal?.crowd.standings[0].photoId).toBe(first);
    expect(reveal?.crowd.standings.map((entry) => entry.photoId)).not.toContain(fourth);

    const stats = await getCollectionKnockoutAdminStatsAction(photoAlbum.id);
    expect(stats?.totalVotes).toBe(12);
    expect(stats?.uniqueSessions).toBe(2);
    expect(stats?.crowdReady).toBe(true);
    expect(stats?.standings.some((entry) => entry.photoId === fourth)).toBe(true);
  });

  it("resets all votes and runs for one album", async () => {
    const deck = await requireDeck(photoAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const [winner, loser] = deck.photos.map((photo) => photo.id);

    await startCollectionKnockoutAction(startInput(photoAlbum, poolHash));
    await recordCollectionKnockoutVoteAction(
      voteInput(photoAlbum, poolHash, winner, loser)
    );
    await completeCollectionKnockoutAction(
      completeInput(photoAlbum, poolHash, winner)
    );
    expect(await voteCount(photoAlbum.id)).toBe(1);
    expect(await runCount(photoAlbum.id)).toBe(1);

    const reset = await resetCollectionKnockoutAction(photoAlbum.id);
    expect(reset.success).toBe(true);
    expect(await voteCount(photoAlbum.id)).toBe(0);
    expect(await runCount(photoAlbum.id)).toBe(0);

    const stats = await getCollectionKnockoutAdminStatsAction(photoAlbum.id);
    expect(stats).toMatchObject({
      startedRuns: 0,
      completedRuns: 0,
      completionRate: null,
      totalVotes: 0,
      uniqueSessions: 0,
      lastVoteAt: null,
      crowdReady: false,
      standings: [],
    });
  });

  it("cleans up knockout votes and runs when a photo leaves an album", async () => {
    const deck = await requireDeck(cleanupAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const seed = `${run}_cleanup_item`;
    const deckIds = deck.photos.map((photo) => photo.id);
    expect(deckIds).toContain(extraPhotoId);
    const otherA = deckIds.find((id) => id !== extraPhotoId);
    const otherB = deckIds.find((id) => id !== extraPhotoId && id !== otherA);
    if (!otherA || !otherB) throw new Error("Expected two other photos");

    await startCollectionKnockoutAction(
      startInput(cleanupAlbum, poolHash, sessionOne, seed, "all", 4)
    );
    await recordCollectionKnockoutVoteAction(
      voteInput(cleanupAlbum, poolHash, extraPhotoId, otherA, 0, 0, sessionOne, seed)
    );
    await recordCollectionKnockoutVoteAction(
      voteInput(cleanupAlbum, poolHash, otherB, otherA, 1, 0, sessionOne, seed)
    );
    await completeCollectionKnockoutAction(
      completeInput(cleanupAlbum, poolHash, extraPhotoId, sessionOne, seed, 4)
    );
    expect(await voteCount(cleanupAlbum.id)).toBe(2);
    expect(await runCount(cleanupAlbum.id)).toBe(1);

    await removeItemFromCollectionAction(cleanupAlbum.id, "photo", extraPhotoId);

    const remainingVotes = await db
      .select()
      .from(collectionKnockoutVotes)
      .where(eq(collectionKnockoutVotes.collectionId, cleanupAlbum.id));
    expect(remainingVotes).toHaveLength(1);
    expect(
      remainingVotes.every(
        (vote) => vote.winnerPhotoId !== extraPhotoId && vote.loserPhotoId !== extraPhotoId
      )
    ).toBe(true);
    expect(await runCount(cleanupAlbum.id)).toBe(0);
  });

  it("cleans up knockout data when a gallery photo is deleted", async () => {
    const deck = await requireDeck(galleryAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const seed = `${run}_cleanup_gallery`;
    const deckIds = deck.photos.map((photo) => photo.id);
    expect(deckIds).toContain(disposablePhotoId);
    const otherA = deckIds.find((id) => id !== disposablePhotoId);
    const otherB = deckIds.find((id) => id !== disposablePhotoId && id !== otherA);
    if (!otherA || !otherB) throw new Error("Expected two other photos");

    await startCollectionKnockoutAction(
      startInput(galleryAlbum, poolHash, sessionOne, seed, "all", 4)
    );
    await recordCollectionKnockoutVoteAction(
      voteInput(galleryAlbum, poolHash, disposablePhotoId, otherA, 0, 0, sessionOne, seed)
    );
    await recordCollectionKnockoutVoteAction(
      voteInput(galleryAlbum, poolHash, otherB, otherA, 1, 0, sessionOne, seed)
    );
    await completeCollectionKnockoutAction(
      completeInput(galleryAlbum, poolHash, disposablePhotoId, sessionOne, seed, 4)
    );

    const deletion = await deleteGalleryPhoto(disposablePhotoId);
    expect(deletion.success).toBe(true);

    const remainingVotes = await db
      .select()
      .from(collectionKnockoutVotes)
      .where(eq(collectionKnockoutVotes.collectionId, galleryAlbum.id));
    expect(remainingVotes).toHaveLength(1);
    expect(
      remainingVotes.every(
        (vote) =>
          vote.winnerPhotoId !== disposablePhotoId &&
          vote.loserPhotoId !== disposablePhotoId
      )
    ).toBe(true);
    expect(await runCount(galleryAlbum.id)).toBe(0);
  });

  it("cleans up knockout data when a collection is deleted", async () => {
    const deck = await requireDeck(deleteAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const seed = `${run}_cleanup_collection`;
    const [first, second] = deck.photos.map((photo) => photo.id);

    await startCollectionKnockoutAction(startInput(deleteAlbum, poolHash, sessionOne, seed));
    await recordCollectionKnockoutVoteAction(
      voteInput(deleteAlbum, poolHash, first, second, 0, 0, sessionOne, seed)
    );
    await completeCollectionKnockoutAction(
      completeInput(deleteAlbum, poolHash, first, sessionOne, seed, 2)
    );
    expect(await voteCount(deleteAlbum.id)).toBe(1);
    expect(await runCount(deleteAlbum.id)).toBe(1);

    const deletion = await deleteCollectionAction(deleteAlbum.id);
    expect(deletion.success).toBe(true);
    expect(await voteCount(deleteAlbum.id)).toBe(0);
    expect(await runCount(deleteAlbum.id)).toBe(0);
    expect(await getCollectionKnockoutDeckAction(deleteAlbum.slug)).toBeNull();
  });

  it("never writes in preview mode", async () => {
    const deck = await requireDeck(photoAlbum.slug);
    const poolHash = hashPhotoPool(deck.photos.map((photo) => photo.id));
    const [winner, loser] = deck.photos.map((photo) => photo.id);
    const seed = `${run}_preview`;

    const start = await startCollectionKnockoutAction({
      ...startInput(photoAlbum, poolHash, sessionOne, seed),
      preview: true,
    });
    expect(start).toMatchObject({ success: true, recorded: false });

    const vote = await recordCollectionKnockoutVoteAction({
      ...voteInput(photoAlbum, poolHash, winner, loser, 0, 0, sessionOne, seed),
      preview: true,
    });
    expect(vote).toMatchObject({ success: true, recorded: false });

    const complete = await completeCollectionKnockoutAction({
      ...completeInput(photoAlbum, poolHash, winner, sessionOne, seed),
      preview: true,
    });
    expect(complete).toMatchObject({ success: true, recorded: false });

    expect(await voteCount(photoAlbum.id)).toBe(0);
    expect(await runCount(photoAlbum.id)).toBe(0);
  });
});
