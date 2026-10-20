import { describe, expect, it } from "vitest";
import {
  collectionCountLabel,
  filterAndSortCollections,
  formatRelativeDate,
  formatViewCount,
  getCollectionPreviewPath,
  selectFeaturedCollection,
} from "../src/features/libraries/collection-helpers";
import type {
  CollectionCounts,
  CollectionOverview,
} from "../src/features/libraries/collection-types";

function counts(overrides: Partial<CollectionCounts> = {}): CollectionCounts {
  const base: CollectionCounts = {
    photos: 0,
    movies: 0,
    shows: 0,
    artists: 0,
    albums: 0,
    tracks: 0,
    people: 0,
    total: 0,
  };
  const merged = { ...base, ...overrides };
  merged.total =
    merged.photos +
    merged.movies +
    merged.shows +
    merged.artists +
    merged.albums +
    merged.tracks +
    merged.people;
  return merged;
}

function makeCollection(
  overrides: Partial<CollectionOverview> = {}
): CollectionOverview {
  const id = overrides.id ?? "col_default";
  return {
    id,
    name: "Untitled collection",
    slug: id,
    description: null,
    color: null,
    icon: null,
    kind: "mixed",
    visibility: "private",
    shareToken: null,
    coverPhotoId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    counts: counts(),
    coverUrl: null,
    sharePath: null,
    analytics: { viewCount: 0, lastViewedAt: null },
    ...overrides,
  };
}

describe("collection index helpers", () => {
  const alps = makeCollection({
    id: "alps",
    name: "Alps",
    description: "Snow and granite",
    kind: "photo",
    visibility: "public",
    updatedAt: "2026-03-02T00:00:00.000Z",
    counts: counts({ photos: 4 }),
    analytics: { viewCount: 12, lastViewedAt: null },
  });
  const cinema = makeCollection({
    id: "cinema",
    name: "Cinema",
    description: "Films for winter",
    kind: "media",
    visibility: "unlisted",
    updatedAt: "2026-03-01T00:00:00.000Z",
    counts: counts({ movies: 2, shows: 1 }),
    analytics: { viewCount: 40, lastViewedAt: null },
  });
  const listening = makeCollection({
    id: "listening",
    name: "Listening",
    description: null,
    kind: "media",
    visibility: "private",
    updatedAt: "2026-02-20T00:00:00.000Z",
    counts: counts({ artists: 1, albums: 2, tracks: 3 }),
    analytics: { viewCount: 3, lastViewedAt: null },
  });
  const all = [alps, cinema, listening];

  it("filters by search text, kind, and visibility then sorts", () => {
    const search = filterAndSortCollections(all, {
      query: "snow",
      kind: "all",
      visibility: "all",
      sort: "updated",
    });
    expect(search.map((item) => item.id)).toEqual(["alps"]);

    const media = filterAndSortCollections(all, {
      query: "",
      kind: "media",
      visibility: "all",
      sort: "name",
    });
    expect(media.map((item) => item.id)).toEqual(["cinema", "listening"]);

    const visible = filterAndSortCollections(all, {
      query: "",
      kind: "all",
      visibility: "public",
      sort: "updated",
    });
    expect(visible.map((item) => item.id)).toEqual(["alps"]);

    const byItems = filterAndSortCollections(all, {
      query: "",
      kind: "all",
      visibility: "all",
      sort: "items",
    });
    expect(byItems.map((item) => item.id)).toEqual(["listening", "alps", "cinema"]);

    const byViews = filterAndSortCollections(all, {
      query: "",
      kind: "all",
      visibility: "all",
      sort: "views",
    });
    expect(byViews.map((item) => item.id)).toEqual(["cinema", "alps", "listening"]);
  });

  it("selects the most recently updated collection as featured", () => {
    expect(selectFeaturedCollection(all)?.id).toBe("alps");
    expect(selectFeaturedCollection([])).toBeNull();
  });

  it("formats collection metadata and preview URLs", () => {
    const mixed = makeCollection({
      counts: counts({ photos: 3, movies: 1, shows: 1, artists: 1, albums: 1, tracks: 2, people: 1 }),
    });
    expect(collectionCountLabel(mixed)).toBe(
      "3 photos · 2 films · 4 music items · 1 person"
    );
    expect(formatViewCount(999)).toBe("999");
    expect(formatViewCount(1200)).toBe("1.2k");
    expect(formatViewCount(12_500)).toBe("13k");
    expect(formatViewCount(2_400_000)).toBe("2.4m");
    expect(
      formatRelativeDate("2026-01-01T00:00:00.000Z", Date.parse("2026-01-01T01:05:00.000Z"))
    ).toBe("1h ago");
    expect(getCollectionPreviewPath("/collections/alps")).toBe(
      "/collections/alps?preview=1"
    );
    expect(getCollectionPreviewPath("/collections/alps?share=token")).toBe(
      "/collections/alps?share=token&preview=1"
    );
  });
});
