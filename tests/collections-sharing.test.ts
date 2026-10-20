import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db, ensureDbInitialized } from "../src/db";
import {
  collectionAnalytics,
  collectionItems,
  collections,
  gallery,
  movieMetadata,
  traktMovies,
} from "../src/db/schema";
import {
  addItemToCollectionAction,
  addPhotosToCollectionAction,
  createCollectionAction,
  getCollectionDetailAction,
  getCollectionsAction,
  getCollectionsOverviewAction,
  getPhotoCollectionsAction,
  getPublicCollectionAction,
  getPublicCollectionsAction,
  recordCollectionViewAction,
  regenerateCollectionShareTokenAction,
  setCollectionCoverAction,
  setCollectionVisibilityAction,
  updateCollectionAction,
} from "../src/features/libraries/actions/collections";
import { deleteGalleryPhoto } from "../src/features/gallery/actions";
import {
  getCollectionPreviewPath,
  getCollectionSharePath,
} from "../src/features/libraries/collection-helpers";

const run = `share_${Date.now().toString(36)}`;
const photoPublicId = `${run}_photo_public`;
const photoUnlistedId = `${run}_photo_unlisted`;
const photoPrivateId = `${run}_photo_private`;
const photoDisposableId = `${run}_photo_disposable`;
const numericBase = 9876500;
const publicMovieId = numericBase + 1;
const privateMovieId = numericBase + 2;
const now = new Date().toISOString();
const collectionIds: string[] = [];

function requireId(result: { success: boolean; id?: string; slug?: string }): {
  id: string;
  slug: string;
} {
  expect(result.success).toBe(true);
  if (!result.id || !result.slug) throw new Error("Collection creation did not return an id and slug");
  collectionIds.push(result.id);
  return { id: result.id, slug: result.slug };
}

function requireDetail<T>(detail: T | null): T {
  expect(detail).not.toBeNull();
  return detail as T;
}

async function createCollection(
  name: string,
  kind: "photo" | "media" | "mixed"
): Promise<{ id: string; slug: string }> {
  return requireId(await createCollectionAction(name, "Sharing test collection", "#ff6600", "Folder", kind));
}

function tokenFromPath(sharePath: string): string {
  const token = new URL(sharePath, "https://example.com").searchParams.get("share");
  if (!token) throw new Error(`No share token in ${sharePath}`);
  return token;
}

describe("Shareable collection links", () => {
  let mixed: { id: string; slug: string };
  let photoOnly: { id: string; slug: string };
  let mediaOnly: { id: string; slug: string };
  let publicIndex: { id: string; slug: string };

  beforeAll(async () => {
    await ensureDbInitialized();

    await db
      .insert(gallery)
      .values([
        {
          id: photoPublicId,
          title: "Public Alpine Photo",
          slug: `${run}-public-photo`,
          description: "A public photo",
          originalUrl: "https://secret.example/original-secret-public.jpg",
          largeUrl: "https://cdn.example/large-public.jpg",
          mediumUrl: "https://cdn.example/medium-public.jpg",
          thumbnailUrl: "https://cdn.example/thumb-public.jpg",
          width: 4000,
          height: 3000,
          camera: "Fujifilm X100V",
          lens: "23mm",
          focalLength: "23mm",
          aperture: "f/2.0",
          shutterSpeed: "1/250",
          iso: 160,
          takenAt: null,
          latitude: 46.0207,
          longitude: 7.7491,
          locationName: "Zermatt",
          visibility: "public",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: photoUnlistedId,
          title: "Unlisted Photo",
          slug: `${run}-unlisted-photo`,
          description: null,
          originalUrl: "https://secret.example/original-secret-unlisted.jpg",
          largeUrl: "https://cdn.example/large-unlisted.jpg",
          mediumUrl: "https://cdn.example/medium-unlisted.jpg",
          thumbnailUrl: "https://cdn.example/thumb-unlisted.jpg",
          width: 3000,
          height: 2000,
          takenAt: "2020-05-01T00:00:00.000Z",
          visibility: "unlisted",
          createdAt: "2021-01-01T00:00:00.000Z",
          updatedAt: "2021-01-01T00:00:00.000Z",
        },
        {
          id: photoPrivateId,
          title: "Private Photo",
          slug: `${run}-private-photo`,
          description: null,
          originalUrl: "https://secret.example/original-secret-private.jpg",
          largeUrl: "https://cdn.example/large-private.jpg",
          mediumUrl: "https://cdn.example/medium-private.jpg",
          thumbnailUrl: "https://cdn.example/thumb-private.jpg",
          width: 3000,
          height: 2000,
          takenAt: "2022-05-01T00:00:00.000Z",
          visibility: "private",
          createdAt: "2022-01-01T00:00:00.000Z",
          updatedAt: "2022-01-01T00:00:00.000Z",
        },
        {
          id: photoDisposableId,
          title: "Disposable Photo",
          slug: `${run}-disposable-photo`,
          description: null,
          originalUrl: "https://secret.example/original-disposable.jpg",
          largeUrl: "https://cdn.example/large-disposable.jpg",
          mediumUrl: "https://cdn.example/medium-disposable.jpg",
          thumbnailUrl: "https://cdn.example/thumb-disposable.jpg",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(traktMovies)
      .values([
        {
          traktId: publicMovieId,
          title: "Public Movie",
          year: 2024,
          overview: "A public film",
          posterPath: "/public-poster.jpg",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
        {
          traktId: privateMovieId,
          title: "Private Movie",
          year: 2023,
          overview: "A private film",
          posterPath: "/private-poster.jpg",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(movieMetadata)
      .values([
        {
          traktId: publicMovieId,
          favorite: 1,
          personalRating: 9,
          review: "A public review",
          notes: "NEVER_EXPOSE_THIS_NOTE",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
        {
          traktId: privateMovieId,
          favorite: 1,
          personalRating: 10,
          review: "Private review",
          notes: "PRIVATE_MOVIE_NOTE",
          visibility: "private",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    mixed = await createCollection(`${run} Mixed Album`, "mixed");
    photoOnly = await createCollection(`${run} Photo Album`, "photo");
    mediaOnly = await createCollection(`${run} Media Collection`, "media");
    publicIndex = await createCollection(`${run} Public Index`, "photo");

    await addPhotosToCollectionAction(mixed.id, [photoPublicId, photoUnlistedId, photoPrivateId]);
    await addPhotosToCollectionAction(photoOnly.id, [photoPublicId]);
    await addPhotosToCollectionAction(publicIndex.id, [photoPublicId]);
    await addItemToCollectionAction(mixed.id, "movie", publicMovieId);
    await addItemToCollectionAction(mixed.id, "movie", privateMovieId);
  });

  afterAll(async () => {
    if (collectionIds.length > 0) {
      await db.delete(collectionItems).where(inArray(collectionItems.collectionId, collectionIds));
      await db
        .delete(collectionAnalytics)
        .where(inArray(collectionAnalytics.collectionId, collectionIds));
      await db.delete(collections).where(inArray(collections.id, collectionIds));
    }
    await db
      .delete(gallery)
      .where(inArray(gallery.id, [photoPublicId, photoUnlistedId, photoPrivateId, photoDisposableId]));
    await db
      .delete(movieMetadata)
      .where(inArray(movieMetadata.traktId, [publicMovieId, privateMovieId]));
    await db
      .delete(traktMovies)
      .where(inArray(traktMovies.traktId, [publicMovieId, privateMovieId]));
  });

  it("defaults new collections to private and enforces kind compatibility", async () => {
    const rows = await getCollectionsAction();
    const created = rows.find((collection) => collection.id === mixed.id);
    expect(created?.kind).toBe("mixed");
    expect(created?.visibility).toBe("private");
    expect(created?.shareToken).toBeNull();

    const photoResult = await addItemToCollectionAction(mediaOnly.id, "photo", photoPublicId);
    expect(photoResult.success).toBe(false);

    const movieResult = await addItemToCollectionAction(photoOnly.id, "movie", publicMovieId);
    expect(movieResult.success).toBe(false);

    const mixedPhotoResult = await addItemToCollectionAction(mixed.id, "photo", photoPublicId);
    const mixedMovieResult = await addItemToCollectionAction(mixed.id, "movie", publicMovieId);
    expect(mixedPhotoResult.success).toBe(true);
    expect(mixedMovieResult.success).toBe(true);

    const pickerOptions = await getPhotoCollectionsAction();
    expect(pickerOptions.some((collection) => collection.id === photoOnly.id)).toBe(true);
    expect(pickerOptions.some((collection) => collection.id === mixed.id)).toBe(true);
    expect(pickerOptions.some((collection) => collection.id === mediaOnly.id)).toBe(false);
    expect(pickerOptions.find((collection) => collection.id === mixed.id)?.photoIds).toContain(photoPublicId);
  });

  it("hides private collections and requires the exact token for unlisted collections", async () => {
    expect(await getPublicCollectionAction(mixed.slug)).toBeNull();

    const unlistedResult = await setCollectionVisibilityAction(mixed.id, "unlisted");
    expect(unlistedResult.success).toBe(true);
    if (!("sharePath" in unlistedResult) || !unlistedResult.sharePath) {
      throw new Error("Expected an unlisted share path");
    }
    const token = tokenFromPath(unlistedResult.sharePath);
    expect(unlistedResult.sharePath).toBe(`/collections/${mixed.slug}?share=${token}`);

    expect(await getPublicCollectionAction(mixed.slug)).toBeNull();
    expect(await getPublicCollectionAction(mixed.slug, "wrong-token")).toBeNull();

    const unlistedDetail = requireDetail(await getPublicCollectionAction(mixed.slug, token));
    expect(unlistedDetail.collection.visibility).toBe("unlisted");
    expect(unlistedDetail.collection.shareToken).toBeNull();
    expect(unlistedDetail.collection).not.toHaveProperty("coverPhotoId");
    expect(unlistedDetail).not.toHaveProperty("analytics");
    expect(unlistedDetail).not.toHaveProperty("incompatibleCount");
    expect(unlistedDetail.sharePath).toBe(`/collections/${mixed.slug}?share=${token}`);
  });

  it("filters private items, orders photos chronologically, and never exposes notes or originals", async () => {
    const unlistedResult = await setCollectionVisibilityAction(mixed.id, "unlisted");
    const token =
      "sharePath" in unlistedResult && unlistedResult.sharePath
        ? tokenFromPath(unlistedResult.sharePath)
        : undefined;
    const detail = requireDetail(await getPublicCollectionAction(mixed.slug, token));

    expect(detail.photos.map((photo) => photo.id)).toEqual([photoUnlistedId, photoPublicId]);
    expect(detail.photos.some((photo) => photo.id === photoPrivateId)).toBe(false);
    expect(detail.movies.map((movie) => movie.id)).toEqual([String(publicMovieId)]);
    expect(detail.counts.photos).toBe(2);
    expect(detail.counts.movies).toBe(1);

    const photo = detail.photos[0];
    expect(photo).not.toHaveProperty("originalUrl");
    expect(photo).not.toHaveProperty("latitude");
    expect(photo).not.toHaveProperty("longitude");

    const publicPhoto = detail.photos.find((item) => item.id === photoPublicId);
    expect(publicPhoto?.locationName).toBe("Zermatt");
    expect(publicPhoto?.camera).toBe("Fujifilm X100V");

    const movie = detail.movies[0];
    expect(movie.review).toBe("A public review");
    expect(movie.rating).toBe(9);
    expect(movie.favorite).toBe(true);
    expect(movie).not.toHaveProperty("notes");

    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("original-secret");
    expect(serialized).not.toContain("NEVER_EXPOSE_THIS_NOTE");
    expect(serialized).not.toContain("PRIVATE_MOVIE_NOTE");
    expect(serialized).not.toContain("Private Movie");
  });

  it("rotates tokens and revokes the previous unlisted link", async () => {
    const first = await setCollectionVisibilityAction(mixed.id, "unlisted");
    if (!("sharePath" in first) || !first.sharePath) throw new Error("Expected a share path");
    const oldToken = tokenFromPath(first.sharePath);
    expect(await getPublicCollectionAction(mixed.slug, oldToken)).not.toBeNull();

    const rotated = await regenerateCollectionShareTokenAction(mixed.id);
    expect(rotated.success).toBe(true);
    if (!("sharePath" in rotated) || !rotated.sharePath) throw new Error("Expected a new share path");
    const newToken = tokenFromPath(rotated.sharePath);
    expect(newToken).not.toBe(oldToken);

    expect(await getPublicCollectionAction(mixed.slug, oldToken)).toBeNull();
    expect(await getPublicCollectionAction(mixed.slug, newToken)).not.toBeNull();

    await setCollectionVisibilityAction(mixed.id, "public");
    expect(await getPublicCollectionAction(mixed.slug)).not.toBeNull();
  });

  it("lists only public collections in the shared index", async () => {
    await setCollectionVisibilityAction(publicIndex.id, "public");
    await setCollectionVisibilityAction(mixed.id, "public");
    await setCollectionVisibilityAction(photoOnly.id, "unlisted");
    await setCollectionVisibilityAction(mediaOnly.id, "private");

    const publicCollections = await getPublicCollectionsAction();
    const ids = publicCollections.map((collection) => collection.id);
    expect(ids).toContain(mixed.id);
    expect(ids).toContain(publicIndex.id);
    expect(ids).not.toContain(photoOnly.id);
    expect(ids).not.toContain(mediaOnly.id);

    const mixedOverview = publicCollections.find((collection) => collection.id === mixed.id);
    expect(mixedOverview?.coverUrl).toBe("https://cdn.example/medium-unlisted.jpg");
    expect(mixedOverview?.sharePath).toBe(`/collections/${mixed.slug}`);
    expect(mixedOverview).not.toHaveProperty("analytics");
    expect(mixedOverview).not.toHaveProperty("coverPhotoId");

    const adminOverview = await getCollectionsOverviewAction();
    expect(adminOverview.some((collection) => collection.id === mediaOnly.id)).toBe(true);
  });

  it("uses manual covers only for member photos and falls back safely on the public page", async () => {
    await setCollectionVisibilityAction(mixed.id, "public");

    const privateCover = await setCollectionCoverAction(mixed.id, photoPrivateId);
    expect(privateCover.success).toBe(true);

    const adminDetail = requireDetail(await getCollectionDetailAction(mixed.slug));
    expect(adminDetail.collection.coverPhotoId).toBe(photoPrivateId);
    expect(adminDetail.coverUrl).toBe("https://cdn.example/medium-private.jpg");

    const adminOverview = (await getCollectionsOverviewAction()).find(
      (collection) => collection.id === mixed.id
    );
    expect(adminOverview?.coverUrl).toBe("https://cdn.example/medium-private.jpg");

    const publicDetail = requireDetail(await getPublicCollectionAction(mixed.slug));
    expect(publicDetail.coverUrl).toBe("https://cdn.example/medium-unlisted.jpg");
    const publicOverview = (await getPublicCollectionsAction()).find(
      (collection) => collection.id === mixed.id
    );
    expect(publicOverview?.coverUrl).toBe("https://cdn.example/medium-unlisted.jpg");

    const nonMember = await setCollectionCoverAction(mixed.id, photoDisposableId);
    expect(nonMember.success).toBe(false);
    expect((await getCollectionDetailAction(mixed.slug))?.collection.coverPhotoId).toBe(
      photoPrivateId
    );

    const publicCover = await setCollectionCoverAction(mixed.id, photoPublicId);
    expect(publicCover.success).toBe(true);
    expect((await getPublicCollectionAction(mixed.slug))?.coverUrl).toBe(
      "https://cdn.example/medium-public.jpg"
    );

    const automatic = await setCollectionCoverAction(mixed.id, null);
    expect(automatic.success).toBe(true);
    const reset = requireDetail(await getCollectionDetailAction(mixed.slug));
    expect(reset.collection.coverPhotoId).toBeNull();
    expect(reset.coverUrl).toBe("https://cdn.example/medium-unlisted.jpg");
  });

  it("counts total views only for accessible pages and excludes previews", async () => {
    const analyticsCollection = await createCollection(`${run} Analytics`, "photo");
    await addPhotosToCollectionAction(analyticsCollection.id, [photoPublicId]);

    expect((await recordCollectionViewAction(analyticsCollection.id)).counted).toBe(false);
    let detail = requireDetail(await getCollectionDetailAction(analyticsCollection.slug));
    expect(detail.analytics).toEqual({ viewCount: 0, lastViewedAt: null });

    const unlisted = await setCollectionVisibilityAction(analyticsCollection.id, "unlisted");
    if (!("sharePath" in unlisted) || !unlisted.sharePath) {
      throw new Error("Expected an unlisted share path");
    }
    const token = tokenFromPath(unlisted.sharePath);

    expect(
      (await recordCollectionViewAction(analyticsCollection.id, "wrong-token")).counted
    ).toBe(false);
    expect((await recordCollectionViewAction(analyticsCollection.id, token)).counted).toBe(
      true
    );
    expect(
      (await recordCollectionViewAction(analyticsCollection.id, token, true)).counted
    ).toBe(false);
    expect((await recordCollectionViewAction(analyticsCollection.id, token)).counted).toBe(
      true
    );

    await setCollectionVisibilityAction(analyticsCollection.id, "public");
    expect((await recordCollectionViewAction(analyticsCollection.id)).counted).toBe(true);

    detail = requireDetail(await getCollectionDetailAction(analyticsCollection.slug));
    expect(detail.analytics.viewCount).toBe(3);
    expect(detail.analytics.lastViewedAt).not.toBeNull();

    const overview = (await getCollectionsOverviewAction()).find(
      (collection) => collection.id === analyticsCollection.id
    );
    expect(overview?.analytics.viewCount).toBe(3);

    const publicOverview = (await getPublicCollectionsAction()).find(
      (collection) => collection.id === analyticsCollection.id
    );
    expect(publicOverview).toBeDefined();
    expect(publicOverview).not.toHaveProperty("analytics");
  });

  it("flags items hidden by a kind change without deleting them", async () => {
    const updated = await updateCollectionAction(mixed.id, { kind: "media" });
    expect(updated.success).toBe(true);

    const adminDetail = requireDetail(await getCollectionDetailAction(mixed.slug));
    expect(adminDetail.incompatibleCount).toBe(3);
    expect(adminDetail.photos).toHaveLength(3);
    expect(adminDetail.photos.every((photo) => photo.incompatible)).toBe(true);

    const publicDetail = requireDetail(await getPublicCollectionAction(mixed.slug));
    expect(publicDetail.photos).toHaveLength(0);
    expect(publicDetail.counts.photos).toBe(0);

    await updateCollectionAction(mixed.id, { kind: "mixed" });
    const restored = requireDetail(await getCollectionDetailAction(mixed.slug));
    expect(restored.incompatibleCount).toBe(0);
    expect(restored.photos.every((photo) => !photo.incompatible)).toBe(true);
  });

  it("keeps slugs unique when collection names normalize to the same slug", async () => {
    const first = await createCollection(`${run} Collision !!!`, "media");
    const second = await createCollection(`${run} Collision ???`, "media");
    expect(first.slug).not.toBe(second.slug);
    expect(second.slug).toBe(`${first.slug}-2`);
  });

  it("builds share paths for each visibility and cleans up photo links on deletion", async () => {
    expect(
      getCollectionSharePath({ slug: "album", visibility: "private", shareToken: "token" })
    ).toBeNull();
    expect(
      getCollectionSharePath({ slug: "album", visibility: "unlisted", shareToken: "token" })
    ).toBe("/collections/album?share=token");
    expect(
      getCollectionSharePath({ slug: "album", visibility: "public", shareToken: "token" })
    ).toBe("/collections/album");

    await addPhotosToCollectionAction(photoOnly.id, [photoDisposableId]);
    const coverResult = await setCollectionCoverAction(photoOnly.id, photoDisposableId);
    expect(coverResult.success).toBe(true);
    const beforeDelete = requireDetail(await getCollectionDetailAction(photoOnly.slug));
    expect(beforeDelete.photos.some((photo) => photo.id === photoDisposableId)).toBe(true);
    expect(beforeDelete.collection.coverPhotoId).toBe(photoDisposableId);

    await deleteGalleryPhoto(photoDisposableId);
    const afterDelete = requireDetail(await getCollectionDetailAction(photoOnly.slug));
    expect(afterDelete.photos.some((photo) => photo.id === photoDisposableId)).toBe(false);
    expect(afterDelete.collection.coverPhotoId).toBeNull();
  });
});
