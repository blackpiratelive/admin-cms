"use server";

import { ensureDbInitialized, db } from "@/db";
import {
  collectionItems,
  collectionKnockoutRuns,
  collectionKnockoutVotes,
  collections,
  gallery,
  type CollectionRecord,
  type GalleryPhoto,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomBytes, timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { createCachedQuery, purgeTag } from "@/lib/server-cache";
import { knockoutImagePath } from "../knockout-images";
import {
  MIN_CROWD_VOTES,
  computeKnockoutStandings,
  hashPhotoPool,
  nextPowerOfTwo,
  selectCrowdChampion,
  type KnockoutRequestedSize,
  type KnockoutStandingPhoto,
} from "../collection-knockout";
import type {
  CollectionKnockoutAdminStats,
  CollectionKnockoutDeck,
  CollectionKnockoutDeckResult,
  CollectionKnockoutReveal,
  CollectionKnockoutSummary,
  KnockoutDeckPhoto,
  KnockoutRevealPhoto,
} from "../collection-types";

const SESSION_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const SEED_PATTERN = /^[a-zA-Z0-9_.:-]{4,120}$/;
const POOL_HASH_PATTERN = /^[a-f0-9]{8,32}$/;

function nowIso() {
  return new Date().toISOString();
}

function tokensMatch(expected: string | null | undefined, provided: string | null | undefined) {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function isVisiblePhoto(visibility: string | null | undefined): boolean {
  return visibility === "public" || visibility === "unlisted";
}

function isValidSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_PATTERN.test(value);
}

function isValidSeed(value: unknown): value is string {
  return typeof value === "string" && SEED_PATTERN.test(value);
}

function isValidPoolHash(value: unknown): value is string {
  return typeof value === "string" && POOL_HASH_PATTERN.test(value);
}

function isValidPhotoId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function isValidRound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 20;
}

function isValidMatchIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 512;
}

async function findCollection(key: string): Promise<CollectionRecord | null> {
  const rows = await db
    .select()
    .from(collections)
    .where(sql`${collections.slug} = ${key} OR ${collections.id} = ${key}`)
    .limit(1);
  return rows[0] || null;
}

type AccessFailure = "forbidden" | "disabled";
type AccessResult = { collection: CollectionRecord } | { error: AccessFailure };

async function resolvePublicCollection(
  slug: string,
  token?: string | null
): Promise<AccessResult> {
  await ensureDbInitialized();
  const collection = await findCollection(slug);
  if (!collection) return { error: "forbidden" };
  if (collection.visibility === "private") return { error: "forbidden" };
  if (collection.visibility === "unlisted" && !tokensMatch(collection.shareToken, token)) {
    return { error: "forbidden" };
  }
  if (collection.kind !== "photo" || collection.knockoutEnabled === 0) {
    return { error: "disabled" };
  }
  return { collection };
}

async function loadEligiblePhotos(collectionId: string): Promise<GalleryPhoto[]> {
  const rows = await db
    .select({ photo: gallery })
    .from(collectionItems)
    .innerJoin(gallery, eq(gallery.id, collectionItems.itemId))
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.itemType, "photo")
      )
    );

  return rows
    .map((row) => row.photo)
    .filter((photo) => isVisiblePhoto(photo.visibility))
    .sort((a, b) => {
      const aDate = a.takenAt || a.createdAt;
      const bDate = b.takenAt || b.createdAt;
      return aDate.localeCompare(bDate) || a.id.localeCompare(b.id);
    });
}

function toDeckPhoto(
  collectionId: string,
  photo: GalleryPhoto
): KnockoutDeckPhoto {
  return {
    id: photo.id,
    largeUrl: knockoutImagePath(collectionId, photo.id, "large"),
    mediumUrl: knockoutImagePath(collectionId, photo.id, "medium"),
    thumbnailUrl: knockoutImagePath(collectionId, photo.id, "thumbnail"),
    width: photo.width,
    height: photo.height,
  };
}

function toRevealPhoto(photo: GalleryPhoto): KnockoutRevealPhoto {
  return {
    id: photo.id,
    title: photo.title,
    description: photo.description,
    takenAt: photo.takenAt,
    createdAt: photo.createdAt,
    locationName: photo.locationName,
    camera: photo.camera,
    lens: photo.lens,
    focalLength: photo.focalLength,
    aperture: photo.aperture,
    shutterSpeed: photo.shutterSpeed,
    iso: photo.iso,
    mediumUrl: photo.mediumUrl,
    largeUrl: photo.largeUrl,
    width: photo.width,
    height: photo.height,
  };
}

function toStandingPhoto(photo: GalleryPhoto): KnockoutStandingPhoto {
  return {
    id: photo.id,
    title: photo.title,
    mediumUrl: photo.mediumUrl,
    thumbnailUrl: photo.thumbnailUrl,
    camera: photo.camera,
  };
}

function purgeKnockoutSummary() {
  purgeTag("knockout-summary");
}

function revalidateKnockoutRoutes(slug: string) {
  try {
    revalidatePath("/collections");
    revalidatePath("/collections", "layout");
    revalidatePath(`/collections/${slug}`);
    revalidatePath(`/collections/${slug}/knockout`);
    revalidatePath("/libraries/collections");
    revalidatePath(`/libraries/collections/${slug}`);
  } catch {
    // Ignore outside an active Next.js server context.
  }
}

async function countKnockoutVotes(collectionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionKnockoutVotes)
    .where(eq(collectionKnockoutVotes.collectionId, collectionId));
  return Number(rows[0]?.count || 0);
}

async function countCompletedRuns(collectionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionKnockoutRuns)
    .where(
      and(
        eq(collectionKnockoutRuns.collectionId, collectionId),
        eq(collectionKnockoutRuns.status, "completed")
      )
    );
  return Number(rows[0]?.count || 0);
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

async function loadDeck(
  slug: string,
  token: string | null
): Promise<CollectionKnockoutDeckResult | null> {
  const access = await resolvePublicCollection(slug, token);
  if ("error" in access) {
    return access.error === "disabled" ? { state: "disabled" } : null;
  }
  const photos = await loadEligiblePhotos(access.collection.id);
  if (photos.length < 2) return { state: "disabled" };

  const deck: CollectionKnockoutDeck = {
    collection: {
      id: access.collection.id,
      name: access.collection.name,
      slug: access.collection.slug,
      description: access.collection.description,
      color: access.collection.color,
      visibility: access.collection.visibility,
    },
    photos: photos.map((photo) => toDeckPhoto(access.collection.id, photo)),
  };

  return { state: "ready", deck };
}

const getKnockoutDeckCached = createCachedQuery(
  async (slug: string, token: string | null): Promise<CollectionKnockoutDeckResult | null> => {
    return loadDeck(slug, token);
  },
  ["collection-knockout-deck"],
  { tags: ["collections-public", "knockout-deck"], revalidate: 60 }
);

export async function getCollectionKnockoutDeckAction(
  slug: string,
  token?: string | null
): Promise<CollectionKnockoutDeckResult | null> {
  return getKnockoutDeckCached(slug, token ?? null);
}

async function loadSummary(
  slug: string,
  token: string | null
): Promise<CollectionKnockoutSummary | null> {
  const access = await resolvePublicCollection(slug, token);
  if ("error" in access) return null;

  const [totalVotes, completedRuns] = await Promise.all([
    countKnockoutVotes(access.collection.id),
    countCompletedRuns(access.collection.id),
  ]);

  return {
    completedRuns,
    totalVotes,
    crowdReady: totalVotes >= MIN_CROWD_VOTES,
  };
}

const getKnockoutSummaryCached = createCachedQuery(
  async (slug: string, token: string | null): Promise<CollectionKnockoutSummary | null> => {
    return loadSummary(slug, token);
  },
  ["collection-knockout-summary"],
  { tags: ["knockout-summary"], revalidate: 30 }
);

export async function getCollectionKnockoutSummaryAction(
  slug: string,
  token?: string | null
): Promise<CollectionKnockoutSummary | null> {
  return getKnockoutSummaryCached(slug, token ?? null);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface StartKnockoutInput {
  slug: string;
  token?: string | null;
  sessionId: string;
  seed: string;
  poolHash: string;
  requestedSize: KnockoutRequestedSize;
  bracketSize: number;
  preview?: boolean;
}

export async function startCollectionKnockoutAction(
  input: StartKnockoutInput
): Promise<{ success: boolean; recorded: boolean; error?: string }> {
  if (input.preview) return { success: true, recorded: false };
  if (!isValidSessionId(input.sessionId) || !isValidSeed(input.seed)) {
    return { success: false, recorded: false, error: "Invalid knockout session." };
  }
  if (!isValidPoolHash(input.poolHash)) {
    return { success: false, recorded: false, error: "Invalid photo pool." };
  }

  const access = await resolvePublicCollection(input.slug, input.token);
  if ("error" in access) {
    return { success: false, recorded: false, error: "This knockout is not available." };
  }

  const photos = await loadEligiblePhotos(access.collection.id);
  const currentPoolHash = hashPhotoPool(photos.map((photo) => photo.id));
  if (currentPoolHash !== input.poolHash) {
    return { success: false, recorded: false, error: "The album changed. Start a fresh knockout." };
  }

  const bracketSize = Math.floor(input.bracketSize);
  const maxBracketSize = nextPowerOfTwo(photos.length);
  if (!Number.isFinite(bracketSize) || bracketSize < 2 || bracketSize > maxBracketSize) {
    return { success: false, recorded: false, error: "Invalid bracket size." };
  }
  if (
    input.requestedSize !== 8 &&
    input.requestedSize !== 16 &&
    input.requestedSize !== "all"
  ) {
    return { success: false, recorded: false, error: "Invalid bracket size." };
  }
  if (
    (input.requestedSize === 8 && photos.length < 8) ||
    (input.requestedSize === 16 && photos.length < 16)
  ) {
    return { success: false, recorded: false, error: "Invalid bracket size." };
  }
  const expectedBracketSize =
    input.requestedSize === "all" ? maxBracketSize : input.requestedSize;
  if (bracketSize !== expectedBracketSize) {
    return { success: false, recorded: false, error: "Invalid bracket size." };
  }

  const existing = await db
    .select({ id: collectionKnockoutRuns.id })
    .from(collectionKnockoutRuns)
    .where(
      and(
        eq(collectionKnockoutRuns.collectionId, access.collection.id),
        eq(collectionKnockoutRuns.sessionId, input.sessionId),
        eq(collectionKnockoutRuns.seed, input.seed)
      )
    )
    .limit(1);

  if (!existing[0]) {
    await db.insert(collectionKnockoutRuns).values({
      id: `kr_${Date.now()}_${randomBytes(3).toString("hex")}`,
      collectionId: access.collection.id,
      sessionId: input.sessionId,
      seed: input.seed,
      poolHash: currentPoolHash,
      bracketSize,
      status: "started",
      championPhotoId: null,
      matchesPlayed: 0,
      startedAt: nowIso(),
      completedAt: null,
    }).onConflictDoNothing();
  }

  purgeKnockoutSummary();
  return { success: true, recorded: true };
}

export interface RecordKnockoutVoteInput {
  slug: string;
  token?: string | null;
  sessionId: string;
  seed: string;
  round: number;
  matchIndex: number;
  winnerPhotoId: string;
  loserPhotoId: string;
  preview?: boolean;
}

export async function recordCollectionKnockoutVoteAction(
  input: RecordKnockoutVoteInput
): Promise<{ success: boolean; recorded: boolean; error?: string }> {
  if (input.preview) return { success: true, recorded: false };
  if (!isValidSessionId(input.sessionId) || !isValidSeed(input.seed)) {
    return { success: false, recorded: false, error: "Invalid knockout session." };
  }
  if (!isValidRound(input.round) || !isValidMatchIndex(input.matchIndex)) {
    return { success: false, recorded: false, error: "Invalid match position." };
  }
  if (
    !isValidPhotoId(input.winnerPhotoId) ||
    !isValidPhotoId(input.loserPhotoId) ||
    input.winnerPhotoId === input.loserPhotoId
  ) {
    return { success: false, recorded: false, error: "Invalid matchup." };
  }

  const access = await resolvePublicCollection(input.slug, input.token);
  if ("error" in access) {
    return { success: false, recorded: false, error: "This knockout is not available." };
  }

  const memberships = await db
    .select({ photoId: collectionItems.itemId, visibility: gallery.visibility })
    .from(collectionItems)
    .innerJoin(gallery, eq(gallery.id, collectionItems.itemId))
    .where(
      and(
        eq(collectionItems.collectionId, access.collection.id),
        eq(collectionItems.itemType, "photo"),
        inArray(collectionItems.itemId, [input.winnerPhotoId, input.loserPhotoId])
      )
    );

  const winner = memberships.find((row) => row.photoId === input.winnerPhotoId);
  const loser = memberships.find((row) => row.photoId === input.loserPhotoId);
  if (
    !winner ||
    !loser ||
    !isVisiblePhoto(winner.visibility) ||
    !isVisiblePhoto(loser.visibility)
  ) {
    return { success: false, recorded: false, error: "Those photos are not in this album." };
  }

  await db
    .insert(collectionKnockoutVotes)
    .values({
      id: `kv_${Date.now()}_${randomBytes(3).toString("hex")}`,
      collectionId: access.collection.id,
      sessionId: input.sessionId,
      seed: input.seed,
      round: input.round,
      matchIndex: input.matchIndex,
      winnerPhotoId: input.winnerPhotoId,
      loserPhotoId: input.loserPhotoId,
      createdAt: nowIso(),
    })
    .onConflictDoNothing();

  return { success: true, recorded: true };
}

export interface CompleteKnockoutInput {
  slug: string;
  token?: string | null;
  sessionId: string;
  seed: string;
  poolHash: string;
  bracketSize: number;
  championPhotoId: string;
  matchesPlayed: number;
  preview?: boolean;
}

export async function completeCollectionKnockoutAction(
  input: CompleteKnockoutInput
): Promise<{ success: boolean; recorded: boolean; error?: string }> {
  if (input.preview) return { success: true, recorded: false };
  if (!isValidSessionId(input.sessionId) || !isValidSeed(input.seed)) {
    return { success: false, recorded: false, error: "Invalid knockout session." };
  }
  if (!isValidPoolHash(input.poolHash) || !isValidPhotoId(input.championPhotoId)) {
    return { success: false, recorded: false, error: "Invalid knockout result." };
  }

  const access = await resolvePublicCollection(input.slug, input.token);
  if ("error" in access) {
    return { success: false, recorded: false, error: "This knockout is not available." };
  }

  const photos = await loadEligiblePhotos(access.collection.id);
  const currentPoolHash = hashPhotoPool(photos.map((photo) => photo.id));
  if (currentPoolHash !== input.poolHash) {
    return { success: false, recorded: false, error: "The album changed." };
  }
  if (!photos.some((photo) => photo.id === input.championPhotoId)) {
    return { success: false, recorded: false, error: "Invalid champion." };
  }

  const bracketSize = Math.floor(input.bracketSize);
  const maxBracketSize = nextPowerOfTwo(photos.length);
  const validBracketSizes = new Set(
    [8, 16, maxBracketSize].filter((size) => size >= 2 && size <= maxBracketSize)
  );
  if (!Number.isFinite(bracketSize) || !validBracketSizes.has(bracketSize)) {
    return { success: false, recorded: false, error: "Invalid bracket size." };
  }
  const matchesPlayed = Math.max(
    1,
    Math.min(
      Number.isFinite(input.matchesPlayed) ? Math.floor(input.matchesPlayed) : 0,
      Math.max(1, bracketSize - 1)
    )
  );
  const completedAt = nowIso();

  const existing = await db
    .select({
      id: collectionKnockoutRuns.id,
      bracketSize: collectionKnockoutRuns.bracketSize,
    })
    .from(collectionKnockoutRuns)
    .where(
      and(
        eq(collectionKnockoutRuns.collectionId, access.collection.id),
        eq(collectionKnockoutRuns.sessionId, input.sessionId),
        eq(collectionKnockoutRuns.seed, input.seed)
      )
    )
    .limit(1);

  if (existing[0] && existing[0].bracketSize !== bracketSize) {
    return { success: false, recorded: false, error: "Invalid bracket size." };
  }

  if (existing[0]) {
    await db
      .update(collectionKnockoutRuns)
      .set({
        status: "completed",
        championPhotoId: input.championPhotoId,
        matchesPlayed,
        completedAt,
        poolHash: currentPoolHash,
        bracketSize,
      })
      .where(eq(collectionKnockoutRuns.id, existing[0].id));
  } else {
    await db.insert(collectionKnockoutRuns).values({
      id: `kr_${Date.now()}_${randomBytes(3).toString("hex")}`,
      collectionId: access.collection.id,
      sessionId: input.sessionId,
      seed: input.seed,
      poolHash: currentPoolHash,
      bracketSize,
      status: "completed",
      championPhotoId: input.championPhotoId,
      matchesPlayed,
      startedAt: completedAt,
      completedAt,
    }).onConflictDoNothing();
  }

  purgeKnockoutSummary();
  return { success: true, recorded: true };
}

// ---------------------------------------------------------------------------
// Reveal / admin
// ---------------------------------------------------------------------------

export interface KnockoutRevealInput {
  slug: string;
  token?: string | null;
  photoIds: string[];
}

export async function getCollectionKnockoutRevealAction(
  input: KnockoutRevealInput
): Promise<CollectionKnockoutReveal | null> {
  const access = await resolvePublicCollection(input.slug, input.token);
  if ("error" in access) return null;

  const requested = Array.from(
    new Set((input.photoIds || []).filter(isValidPhotoId))
  ).slice(0, 8);

  const [photos, votes, completedRuns] = await Promise.all([
    loadEligiblePhotos(access.collection.id),
    db
      .select({
        id: collectionKnockoutVotes.id,
        winnerPhotoId: collectionKnockoutVotes.winnerPhotoId,
        loserPhotoId: collectionKnockoutVotes.loserPhotoId,
        createdAt: collectionKnockoutVotes.createdAt,
      })
      .from(collectionKnockoutVotes)
      .where(eq(collectionKnockoutVotes.collectionId, access.collection.id)),
    countCompletedRuns(access.collection.id),
  ]);

  const photoMap = new Map(photos.map((photo) => [photo.id, photo]));
  const standings = computeKnockoutStandings(
    votes,
    new Map(photos.map((photo) => [photo.id, toStandingPhoto(photo)]))
  );
  const totalVotes = votes.length;
  const crowd = selectCrowdChampion(standings, totalVotes);

  return {
    photos: requested
      .map((id) => photoMap.get(id))
      .filter((photo): photo is GalleryPhoto => Boolean(photo))
      .map(toRevealPhoto),
    crowd: {
      totalVotes,
      completedRuns,
      ready: totalVotes >= MIN_CROWD_VOTES && crowd.length > 0,
      standings: crowd,
    },
  };
}

export async function getCollectionKnockoutAdminStatsAction(
  collectionId: string
): Promise<CollectionKnockoutAdminStats | null> {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  if (!collection) return null;

  const [photos, voteAggregate, runAggregate, votes] = await Promise.all([
    loadEligiblePhotos(collection.id),
    db
      .select({
        count: sql<number>`count(*)`,
        sessions: sql<number>`count(distinct ${collectionKnockoutVotes.sessionId})`,
        lastVoteAt: sql<string | null>`max(${collectionKnockoutVotes.createdAt})`,
      })
      .from(collectionKnockoutVotes)
      .where(eq(collectionKnockoutVotes.collectionId, collection.id)),
    db
      .select({
        started: sql<number>`count(*)`,
        completed: sql<number>`sum(case when ${collectionKnockoutRuns.status} = 'completed' then 1 else 0 end)`,
      })
      .from(collectionKnockoutRuns)
      .where(eq(collectionKnockoutRuns.collectionId, collection.id)),
    db
      .select({
        id: collectionKnockoutVotes.id,
        winnerPhotoId: collectionKnockoutVotes.winnerPhotoId,
        loserPhotoId: collectionKnockoutVotes.loserPhotoId,
        createdAt: collectionKnockoutVotes.createdAt,
      })
      .from(collectionKnockoutVotes)
      .where(eq(collectionKnockoutVotes.collectionId, collection.id)),
  ]);

  const startedRuns = Number(runAggregate[0]?.started || 0);
  const completedRuns = Number(runAggregate[0]?.completed || 0);
  const totalVotes = Number(voteAggregate[0]?.count || 0);
  const standings = computeKnockoutStandings(
    votes,
    new Map(photos.map((photo) => [photo.id, toStandingPhoto(photo)]))
  );

  return {
    enabled: collection.knockoutEnabled !== 0,
    eligible: collection.kind === "photo" && photos.length >= 2,
    photoCount: photos.length,
    startedRuns,
    completedRuns,
    completionRate:
      startedRuns > 0 ? Math.round((completedRuns / startedRuns) * 100) : null,
    totalVotes,
    uniqueSessions: Number(voteAggregate[0]?.sessions || 0),
    lastVoteAt: voteAggregate[0]?.lastVoteAt || null,
    crowdReady: totalVotes >= MIN_CROWD_VOTES,
    standings: standings.slice(0, 5),
  };
}

export async function resetCollectionKnockoutAction(
  collectionId: string
): Promise<{ success: boolean }> {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  if (!collection) return { success: false };

  await db
    .delete(collectionKnockoutVotes)
    .where(eq(collectionKnockoutVotes.collectionId, collection.id));
  await db
    .delete(collectionKnockoutRuns)
    .where(eq(collectionKnockoutRuns.collectionId, collection.id));

  purgeKnockoutSummary();
  revalidateKnockoutRoutes(collection.slug);
  return { success: true };
}

export async function setCollectionKnockoutEnabledAction(
  collectionId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  if (!collection) return { success: false, error: "Collection not found." };

  await db
    .update(collections)
    .set({ knockoutEnabled: enabled ? 1 : 0, updatedAt: nowIso() })
    .where(eq(collections.id, collection.id));

  purgeTag("collections-list");
  purgeTag("collections-public");
  purgeTag("knockout-deck");
  purgeTag(`collection-${collection.id}`);
  purgeTag(`collection-${collection.slug}`);
  purgeTag(`collection-public-${collection.slug}`);
  purgeKnockoutSummary();
  revalidateKnockoutRoutes(collection.slug);

  return { success: true };
}
