"use server";

import { ensureDbInitialized, db } from "@/db";
import {
  collections,
  collectionItems,
  collectionAnalytics,
  collectionKnockoutVotes,
  collectionKnockoutRuns,
  type CollectionRecord,
  gallery,
  traktMovies,
  traktShows,
  movieMetadata,
  tvShowMetadata,
  lastfmArtists,
  lastfmAlbums,
  lastfmTracks,
  artistMetadata,
  albumMetadata,
  trackMetadata,
  persons,
  type GalleryPhoto,
  type PersonRecord,
  type MovieMetadataRecord,
  type TvShowMetadataRecord,
  type ArtistMetadataRecord,
  type AlbumMetadataRecord,
  type TrackMetadataRecord,
  type TraktMovieRecord,
  type TraktShowRecord,
  type LastfmArtistRecord,
  type LastfmAlbumRecord,
  type LastfmTrackRecord,
} from "@/db/schema";
import { eq, and, desc, inArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomBytes, timingSafeEqual } from "crypto";
import { purgeTag, createCachedQuery } from "@/lib/server-cache";
import { getTmdbImageUrl } from "../utils/images";
import {
  getCollectionSharePath,
  isCollectionKind,
  isCollectionVisibility,
  isItemTypeAllowedForKind,
  slugifyCollectionName,
  type CollectionKind,
  type CollectionVisibility,
} from "../collection-helpers";
import {
  emptyCollectionCounts,
  sumCollectionCounts,
  type CollectionAlbumItem,
  type CollectionAnalyticsSummary,
  type CollectionArtistItem,
  type CollectionCounts,
  type CollectionDetail,
  type CollectionMovieItem,
  type CollectionOverview,
  type CollectionPersonItem,
  type CollectionPhotoItem,
  type CollectionPhotoPickerOption,
  type CollectionShowItem,
  type CollectionTrackItem,
  type PublicCollectionDetail,
  type PublicCollectionOverview,
} from "../collection-types";

const SUPPORTED_ITEM_TYPES = new Set([
  "photo",
  "movie",
  "show",
  "artist",
  "album",
  "track",
  "person",
]);

function nowIso() {
  return new Date().toISOString();
}

const EMPTY_ANALYTICS: CollectionAnalyticsSummary = {
  viewCount: 0,
  lastViewedAt: null,
};

function generateShareToken() {
  return randomBytes(24).toString("hex");
}

function tokensMatch(expected: string | null | undefined, provided: string | null | undefined) {
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function revalidateCollectionRoutes(slug?: string | null) {
  try {
    revalidatePath("/gallery");
    revalidatePath("/libraries/collections");
    revalidatePath("/collections", "layout");
    if (slug) {
      revalidatePath(`/libraries/collections/${slug}`);
      revalidatePath(`/collections/${slug}`);
    }
  } catch {
    // Ignore outside an active Next.js server context.
  }
}

function purgeCollectionCaches(input: { id?: string | null; slug?: string | null }) {
  purgeTag("collections-list");
  purgeTag("collections-public");
  purgeTag("knockout-deck");
  if (input.id) purgeTag(`collection-${input.id}`);
  if (input.slug) {
    purgeTag(`collection-${input.slug}`);
    purgeTag(`collection-public-${input.slug}`);
  }
  revalidateCollectionRoutes(input.slug);
}

async function findCollection(key: string): Promise<CollectionRecord | null> {
  const rows = await db
    .select()
    .from(collections)
    .where(or(eq(collections.slug, key), eq(collections.id, key)))
    .limit(1);
  return rows[0] || null;
}

async function uniqueCollectionSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugifyCollectionName(name);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const rows = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.slug, candidate))
      .limit(1);
    if (!rows[0] || rows[0].id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

interface CollectionItemData {
  photos: Map<string, GalleryPhoto>;
  movies: Map<string, { movie: TraktMovieRecord; metadata: MovieMetadataRecord | null }>;
  shows: Map<string, { show: TraktShowRecord; metadata: TvShowMetadataRecord | null }>;
  artists: Map<string, { artist: LastfmArtistRecord; metadata: ArtistMetadataRecord | null }>;
  albums: Map<string, { album: LastfmAlbumRecord; metadata: AlbumMetadataRecord | null }>;
  tracks: Map<string, { track: LastfmTrackRecord; metadata: TrackMetadataRecord | null }>;
  people: Map<string, PersonRecord>;
}

async function loadCollectionItemData(
  items: Array<{ itemType: string; itemId: string; addedAt: string }>
): Promise<CollectionItemData> {
  const photoIds = new Set<string>();
  const movieIds = new Set<number>();
  const showIds = new Set<number>();
  const artistIds = new Set<string>();
  const albumIds = new Set<string>();
  const trackIds = new Set<string>();
  const personIds = new Set<string>();

  for (const item of items) {
    switch (item.itemType) {
      case "photo":
        photoIds.add(item.itemId);
        break;
      case "movie": {
        const id = Number(item.itemId);
        if (Number.isFinite(id)) movieIds.add(id);
        break;
      }
      case "show": {
        const id = Number(item.itemId);
        if (Number.isFinite(id)) showIds.add(id);
        break;
      }
      case "artist":
        artistIds.add(item.itemId);
        break;
      case "album":
        albumIds.add(item.itemId);
        break;
      case "track":
        trackIds.add(item.itemId);
        break;
      case "person":
        personIds.add(item.itemId);
        break;
    }
  }

  const [
    photoRows,
    movieRows,
    showRows,
    artistRows,
    albumRows,
    trackRows,
    personRows,
  ] = await Promise.all([
    photoIds.size
      ? db.select().from(gallery).where(inArray(gallery.id, Array.from(photoIds)))
      : Promise.resolve([] as GalleryPhoto[]),
    movieIds.size
      ? db
          .select({ movie: traktMovies, metadata: movieMetadata })
          .from(traktMovies)
          .leftJoin(movieMetadata, eq(traktMovies.traktId, movieMetadata.traktId))
          .where(inArray(traktMovies.traktId, Array.from(movieIds)))
      : Promise.resolve([] as Array<{ movie: TraktMovieRecord; metadata: MovieMetadataRecord | null }>),
    showIds.size
      ? db
          .select({ show: traktShows, metadata: tvShowMetadata })
          .from(traktShows)
          .leftJoin(tvShowMetadata, eq(traktShows.traktId, tvShowMetadata.traktId))
          .where(inArray(traktShows.traktId, Array.from(showIds)))
      : Promise.resolve([] as Array<{ show: TraktShowRecord; metadata: TvShowMetadataRecord | null }>),
    artistIds.size
      ? db
          .select({ artist: lastfmArtists, metadata: artistMetadata })
          .from(lastfmArtists)
          .leftJoin(artistMetadata, eq(lastfmArtists.artistName, artistMetadata.artistName))
          .where(inArray(lastfmArtists.artistName, Array.from(artistIds)))
      : Promise.resolve([] as Array<{ artist: LastfmArtistRecord; metadata: ArtistMetadataRecord | null }>),
    albumIds.size
      ? db
          .select({ album: lastfmAlbums, metadata: albumMetadata })
          .from(lastfmAlbums)
          .leftJoin(albumMetadata, eq(lastfmAlbums.id, albumMetadata.id))
          .where(inArray(lastfmAlbums.id, Array.from(albumIds)))
      : Promise.resolve([] as Array<{ album: LastfmAlbumRecord; metadata: AlbumMetadataRecord | null }>),
    trackIds.size
      ? db
          .select({ track: lastfmTracks, metadata: trackMetadata })
          .from(lastfmTracks)
          .leftJoin(trackMetadata, eq(lastfmTracks.id, trackMetadata.id))
          .where(inArray(lastfmTracks.id, Array.from(trackIds)))
      : Promise.resolve([] as Array<{ track: LastfmTrackRecord; metadata: TrackMetadataRecord | null }>),
    personIds.size
      ? db.select().from(persons).where(inArray(persons.id, Array.from(personIds)))
      : Promise.resolve([] as PersonRecord[]),
  ]);

  return {
    photos: new Map(photoRows.map((row) => [row.id, row])),
    movies: new Map(movieRows.map((row) => [String(row.movie.traktId), row])),
    shows: new Map(showRows.map((row) => [String(row.show.traktId), row])),
    artists: new Map(artistRows.map((row) => [row.artist.artistName, row])),
    albums: new Map(albumRows.map((row) => [row.album.id, row])),
    tracks: new Map(trackRows.map((row) => [row.track.id, row])),
    people: new Map(personRows.map((row) => [row.id, row])),
  };
}

function movieVisibility(row: { movie: TraktMovieRecord; metadata: MovieMetadataRecord | null }): string {
  if (row.movie.visibility === "private" || row.metadata?.visibility === "private") return "private";
  if (row.movie.visibility === "unlisted" || row.metadata?.visibility === "unlisted") return "unlisted";
  return "public";
}

function showVisibility(row: { show: TraktShowRecord; metadata: TvShowMetadataRecord | null }): string {
  if (row.show.visibility === "private" || row.metadata?.visibility === "private") return "private";
  if (row.show.visibility === "unlisted" || row.metadata?.visibility === "unlisted") return "unlisted";
  return "public";
}

function musicVisibility(hidden: number | null | undefined, metadataVisibility: string | null | undefined): string {
  if (hidden === 1) return "private";
  if (metadataVisibility === "private") return "private";
  if (metadataVisibility === "unlisted") return "unlisted";
  return "public";
}

function isVisible(visibility: string | null | undefined): boolean {
  return visibility === "public" || visibility === "unlisted";
}

function itemAllowedForKind(kind: string, itemType: string): boolean {
  return isItemTypeAllowedForKind(kind, itemType);
}

function photoDate(photo: GalleryPhoto): string {
  return photo.takenAt || photo.createdAt;
}

function buildPhotoItem(photo: GalleryPhoto, addedAt: string): CollectionPhotoItem {
  return {
    itemType: "photo",
    id: photo.id,
    title: photo.title,
    description: photo.description,
    thumbnailUrl: photo.thumbnailUrl,
    mediumUrl: photo.mediumUrl,
    largeUrl: photo.largeUrl,
    width: photo.width,
    height: photo.height,
    takenAt: photo.takenAt,
    createdAt: photo.createdAt,
    visibility: photo.visibility,
    camera: photo.camera,
    lens: photo.lens,
    focalLength: photo.focalLength,
    aperture: photo.aperture,
    shutterSpeed: photo.shutterSpeed,
    iso: photo.iso,
    locationName: photo.locationName,
    addedAt,
  };
}

function buildMovieItem(
  row: { movie: TraktMovieRecord; metadata: MovieMetadataRecord | null },
  addedAt: string
): CollectionMovieItem {
  return {
    itemType: "movie",
    id: String(row.movie.traktId),
    title: row.movie.title,
    year: row.movie.year,
    posterUrl: getTmdbImageUrl(row.movie.posterPath, "poster") || null,
    overview: row.movie.overview,
    favorite: (row.metadata?.favorite ?? row.movie.favorite) === 1,
    rating: row.metadata?.personalRating ?? null,
    review: row.metadata?.review || row.movie.review || null,
    visibility: movieVisibility(row),
    addedAt,
  };
}

function buildShowItem(
  row: { show: TraktShowRecord; metadata: TvShowMetadataRecord | null },
  addedAt: string
): CollectionShowItem {
  return {
    itemType: "show",
    id: String(row.show.traktId),
    title: row.show.title,
    year: row.show.year,
    status: row.show.status,
    posterUrl: getTmdbImageUrl(row.show.posterPath, "poster") || null,
    overview: row.show.overview,
    favorite: (row.metadata?.favorite ?? row.show.favorite) === 1,
    rating: row.metadata?.personalRating ?? null,
    review: row.metadata?.review || row.show.review || null,
    visibility: showVisibility(row),
    addedAt,
  };
}

function buildArtistItem(
  row: { artist: LastfmArtistRecord; metadata: ArtistMetadataRecord | null },
  addedAt: string
): CollectionArtistItem {
  return {
    itemType: "artist",
    id: row.artist.artistName,
    name: row.artist.artistName,
    playCount: row.artist.playCount,
    favorite: (row.metadata?.favorite ?? row.artist.favorite) === 1,
    rating: row.metadata?.personalRating ?? null,
    review: row.metadata?.review || row.artist.review || null,
    visibility: musicVisibility(row.artist.hidden, row.metadata?.visibility),
    addedAt,
  };
}

function buildAlbumItem(
  row: { album: LastfmAlbumRecord; metadata: AlbumMetadataRecord | null },
  addedAt: string
): CollectionAlbumItem {
  return {
    itemType: "album",
    id: row.album.id,
    name: row.album.albumName,
    artist: row.album.artist,
    playCount: row.album.playCount,
    favorite: (row.metadata?.favorite ?? row.album.favorite) === 1,
    rating: row.metadata?.personalRating ?? null,
    review: row.metadata?.review || row.album.review || null,
    visibility: musicVisibility(row.album.hidden, row.metadata?.visibility),
    addedAt,
  };
}

function buildTrackItem(
  row: { track: LastfmTrackRecord; metadata: TrackMetadataRecord | null },
  addedAt: string
): CollectionTrackItem {
  return {
    itemType: "track",
    id: row.track.id,
    name: row.track.trackName,
    artist: row.track.artist,
    playCount: row.track.playCount,
    favorite: (row.metadata?.favorite ?? row.track.favorite) === 1,
    rating: row.metadata?.personalRating ?? null,
    review: row.track.review || null,
    visibility: musicVisibility(row.track.hidden, row.metadata?.visibility),
    addedAt,
  };
}

function buildPersonItem(person: PersonRecord, addedAt: string): CollectionPersonItem {
  return {
    itemType: "person",
    id: person.id,
    name: person.displayName || person.name || "Unknown person",
    avatarUrl: person.avatarUrl,
    visibility: person.visibility || "private",
    addedAt,
  };
}

async function loadAnalyticsSummaries(
  collectionIds: string[]
): Promise<Map<string, CollectionAnalyticsSummary>> {
  if (collectionIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(collectionAnalytics)
    .where(inArray(collectionAnalytics.collectionId, collectionIds));
  return new Map(
    rows.map((row) => [
      row.collectionId,
      { viewCount: row.viewCount, lastViewedAt: row.lastViewedAt },
    ])
  );
}

function manualCoverUrl(
  collection: CollectionRecord,
  items: Array<{ itemType: string; itemId: string; addedAt: string }>,
  data: CollectionItemData,
  publicOnly: boolean
): string | null {
  if (!collection.coverPhotoId) return null;
  if (
    !items.some(
      (item) => item.itemType === "photo" && item.itemId === collection.coverPhotoId
    )
  ) {
    return null;
  }
  const photo = data.photos.get(collection.coverPhotoId);
  if (!photo) return null;
  if (
    publicOnly &&
    (!isVisible(photo.visibility) || !itemAllowedForKind(collection.kind, "photo"))
  ) {
    return null;
  }
  return photo.mediumUrl || photo.thumbnailUrl || null;
}

function autoDetailCoverUrl(
  photos: CollectionPhotoItem[],
  movies: CollectionMovieItem[],
  shows: CollectionShowItem[],
  people: CollectionPersonItem[]
): string | null {
  const firstPhoto = photos[0];
  return (
    (firstPhoto ? firstPhoto.mediumUrl || firstPhoto.thumbnailUrl : null) ||
    movies[0]?.posterUrl ||
    shows[0]?.posterUrl ||
    people[0]?.avatarUrl ||
    null
  );
}

function buildCollectionDetail(
  collection: CollectionRecord,
  items: Array<{ itemType: string; itemId: string; addedAt: string }>,
  data: CollectionItemData,
  publicOnly: boolean,
  analytics: CollectionAnalyticsSummary = EMPTY_ANALYTICS
): CollectionDetail {
  const photoItems: CollectionPhotoItem[] = [];
  const movies: CollectionMovieItem[] = [];
  const shows: CollectionShowItem[] = [];
  const artists: CollectionArtistItem[] = [];
  const albums: CollectionAlbumItem[] = [];
  const tracks: CollectionTrackItem[] = [];
  const people: CollectionPersonItem[] = [];
  let unsupportedCount = 0;
  let incompatibleCount = 0;

  for (const item of items) {
    if (!SUPPORTED_ITEM_TYPES.has(item.itemType)) {
      unsupportedCount += 1;
      continue;
    }

    const compatible = itemAllowedForKind(collection.kind, item.itemType);
    if (publicOnly && !compatible) {
      unsupportedCount += 1;
      continue;
    }
    if (!publicOnly && !compatible) incompatibleCount += 1;

    switch (item.itemType) {
      case "photo": {
        const photo = data.photos.get(item.itemId);
        if (!photo) break;
        if (publicOnly && !isVisible(photo.visibility)) break;
        const built = buildPhotoItem(photo, item.addedAt);
        if (!compatible) built.incompatible = true;
        photoItems.push(built);
        break;
      }
      case "movie": {
        const row = data.movies.get(item.itemId);
        if (!row) break;
        if (publicOnly && !isVisible(movieVisibility(row))) break;
        const built = buildMovieItem(row, item.addedAt);
        if (!compatible) built.incompatible = true;
        movies.push(built);
        break;
      }
      case "show": {
        const row = data.shows.get(item.itemId);
        if (!row) break;
        if (publicOnly && !isVisible(showVisibility(row))) break;
        const built = buildShowItem(row, item.addedAt);
        if (!compatible) built.incompatible = true;
        shows.push(built);
        break;
      }
      case "artist": {
        const row = data.artists.get(item.itemId);
        if (!row) break;
        if (publicOnly && !isVisible(musicVisibility(row.artist.hidden, row.metadata?.visibility))) break;
        const built = buildArtistItem(row, item.addedAt);
        if (!compatible) built.incompatible = true;
        artists.push(built);
        break;
      }
      case "album": {
        const row = data.albums.get(item.itemId);
        if (!row) break;
        if (publicOnly && !isVisible(musicVisibility(row.album.hidden, row.metadata?.visibility))) break;
        const built = buildAlbumItem(row, item.addedAt);
        if (!compatible) built.incompatible = true;
        albums.push(built);
        break;
      }
      case "track": {
        const row = data.tracks.get(item.itemId);
        if (!row) break;
        if (publicOnly && !isVisible(musicVisibility(row.track.hidden, row.metadata?.visibility))) break;
        const built = buildTrackItem(row, item.addedAt);
        if (!compatible) built.incompatible = true;
        tracks.push(built);
        break;
      }
      case "person": {
        const person = data.people.get(item.itemId);
        if (!person) break;
        if (publicOnly && !isVisible(person.visibility || "private")) break;
        const built = buildPersonItem(person, item.addedAt);
        if (!compatible) built.incompatible = true;
        people.push(built);
        break;
      }
    }
  }

  photoItems.sort((a, b) => {
    const aDate = a.takenAt || a.createdAt;
    const bDate = b.takenAt || b.createdAt;
    return aDate.localeCompare(bDate);
  });

  const counts: CollectionCounts = {
    photos: photoItems.length,
    movies: movies.length,
    shows: shows.length,
    artists: artists.length,
    albums: albums.length,
    tracks: tracks.length,
    people: people.length,
    total: 0,
  };
  counts.total = sumCollectionCounts(counts);

  return {
    collection,
    photos: photoItems,
    movies,
    shows,
    artists,
    albums,
    tracks,
    people,
    unsupportedCount,
    incompatibleCount,
    counts,
    coverUrl:
      manualCoverUrl(collection, items, data, publicOnly) ||
      autoDetailCoverUrl(photoItems, movies, shows, people),
    sharePath: getCollectionSharePath(collection),
    analytics,
  };
}

function itemVisibleForOverview(
  item: { itemType: string; itemId: string },
  data: CollectionItemData,
  publicOnly: boolean
): boolean {
  if (!publicOnly) return true;
  switch (item.itemType) {
    case "photo": {
      const photo = data.photos.get(item.itemId);
      return Boolean(photo && isVisible(photo.visibility));
    }
    case "movie": {
      const row = data.movies.get(item.itemId);
      return Boolean(row && isVisible(movieVisibility(row)));
    }
    case "show": {
      const row = data.shows.get(item.itemId);
      return Boolean(row && isVisible(showVisibility(row)));
    }
    case "artist": {
      const row = data.artists.get(item.itemId);
      return Boolean(row && isVisible(musicVisibility(row.artist.hidden, row.metadata?.visibility)));
    }
    case "album": {
      const row = data.albums.get(item.itemId);
      return Boolean(row && isVisible(musicVisibility(row.album.hidden, row.metadata?.visibility)));
    }
    case "track": {
      const row = data.tracks.get(item.itemId);
      return Boolean(row && isVisible(musicVisibility(row.track.hidden, row.metadata?.visibility)));
    }
    case "person": {
      const person = data.people.get(item.itemId);
      return Boolean(person && isVisible(person.visibility || "private"));
    }
    default:
      return false;
  }
}

function buildCollectionOverview(
  collection: CollectionRecord,
  items: Array<{ itemType: string; itemId: string; addedAt: string }>,
  data: CollectionItemData,
  publicOnly: boolean,
  analytics: CollectionAnalyticsSummary = EMPTY_ANALYTICS
): CollectionOverview {
  const counts = emptyCollectionCounts();
  const coverCandidates: GalleryPhoto[] = [];
  let firstMoviePoster: string | null = null;
  let firstShowPoster: string | null = null;
  let firstPersonAvatar: string | null = null;

  for (const item of items) {
    if (publicOnly && !itemAllowedForKind(collection.kind, item.itemType)) continue;
    if (!itemVisibleForOverview(item, data, publicOnly)) continue;

    switch (item.itemType) {
      case "photo": {
        const photo = data.photos.get(item.itemId);
        if (!photo) break;
        counts.photos += 1;
        coverCandidates.push(photo);
        break;
      }
      case "movie": {
        const row = data.movies.get(item.itemId);
        if (!row) break;
        counts.movies += 1;
        const poster = row.movie.posterPath ? getTmdbImageUrl(row.movie.posterPath, "poster") : "";
        if (!firstMoviePoster && poster) firstMoviePoster = poster;
        break;
      }
      case "show": {
        const row = data.shows.get(item.itemId);
        if (!row) break;
        counts.shows += 1;
        const poster = row.show.posterPath ? getTmdbImageUrl(row.show.posterPath, "poster") : "";
        if (!firstShowPoster && poster) firstShowPoster = poster;
        break;
      }
      case "artist":
        if (!data.artists.get(item.itemId)) break;
        counts.artists += 1;
        break;
      case "album":
        if (!data.albums.get(item.itemId)) break;
        counts.albums += 1;
        break;
      case "track":
        if (!data.tracks.get(item.itemId)) break;
        counts.tracks += 1;
        break;
      case "person": {
        const person = data.people.get(item.itemId);
        if (!person) break;
        counts.people += 1;
        if (!firstPersonAvatar && person.avatarUrl) firstPersonAvatar = person.avatarUrl;
        break;
      }
    }
  }

  counts.total = sumCollectionCounts(counts);
  coverCandidates.sort((a, b) => photoDate(a).localeCompare(photoDate(b)));
  const coverPhoto = coverCandidates[0];
  const coverUrl =
    manualCoverUrl(collection, items, data, publicOnly) ||
    (coverPhoto ? coverPhoto.mediumUrl || coverPhoto.thumbnailUrl : null) ||
    firstMoviePoster ||
    firstShowPoster ||
    firstPersonAvatar ||
    null;

  return {
    ...collection,
    shareToken: publicOnly ? null : collection.shareToken,
    counts,
    coverUrl,
    sharePath: getCollectionSharePath(collection),
    analytics,
  };
}

async function loadAllItemsForCollections(collectionIds: string[]) {
  if (collectionIds.length === 0) return [];
  return db
    .select()
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, collectionIds));
}

async function buildOverviews(publicOnly: boolean): Promise<CollectionOverview[]> {
  const collectionRows = publicOnly
    ? await db
        .select()
        .from(collections)
        .where(eq(collections.visibility, "public"))
        .orderBy(desc(collections.createdAt))
    : await db.select().from(collections).orderBy(desc(collections.createdAt));

  if (collectionRows.length === 0) return [];

  const items = await loadAllItemsForCollections(collectionRows.map((collection) => collection.id));
  const data = await loadCollectionItemData(items);
  const analytics = publicOnly
    ? new Map<string, CollectionAnalyticsSummary>()
    : await loadAnalyticsSummaries(collectionRows.map((collection) => collection.id));
  const itemsByCollection = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = itemsByCollection.get(item.collectionId);
    if (bucket) bucket.push(item);
    else itemsByCollection.set(item.collectionId, [item]);
  }

  return collectionRows.map((collection) =>
    buildCollectionOverview(
      collection,
      itemsByCollection.get(collection.id) || [],
      data,
      publicOnly,
      analytics.get(collection.id) || EMPTY_ANALYTICS
    )
  );
}

function toPublicOverview(collection: CollectionOverview): PublicCollectionOverview {
  const {
    coverPhotoId: _coverPhotoId,
    analytics: _analytics,
    ...publicCollection
  } = collection;
  return { ...publicCollection, shareToken: null };
}

function toPublicDetail(detail: CollectionDetail): PublicCollectionDetail {
  const {
    analytics: _analytics,
    incompatibleCount: _incompatibleCount,
    collection,
    ...publicDetail
  } = detail;
  const {
    coverPhotoId: _coverPhotoId,
    shareToken: _shareToken,
    ...publicCollection
  } = collection;
  return {
    ...publicDetail,
    collection: { ...publicCollection, shareToken: null },
  };
}

const getCollectionsOverviewCached = createCachedQuery(
  async () => {
    await ensureDbInitialized();
    return buildOverviews(false);
  },
  ["collections-overview"],
  { tags: ["collections-list"], revalidate: 30 }
);

const getPublicCollectionsCached = createCachedQuery(
  async () => {
    await ensureDbInitialized();
    return buildOverviews(true);
  },
  ["collections-public-index"],
  { tags: ["collections-public"], revalidate: 60 }
);

export async function getCollectionsAction(): Promise<CollectionRecord[]> {
  await ensureDbInitialized();
  return db.select().from(collections).orderBy(desc(collections.createdAt));
}

export async function getCollectionsOverviewAction(): Promise<CollectionOverview[]> {
  return getCollectionsOverviewCached();
}

export async function getPublicCollectionsAction(): Promise<PublicCollectionOverview[]> {
  const collections = await getPublicCollectionsCached();
  return collections.map(toPublicOverview);
}

export async function getPhotoCollectionsAction(): Promise<CollectionPhotoPickerOption[]> {
  await ensureDbInitialized();
  const collectionRows = await db
    .select()
    .from(collections)
    .where(inArray(collections.kind, ["photo", "mixed"]))
    .orderBy(desc(collections.createdAt));

  if (collectionRows.length === 0) return [];

  const items = await db
    .select()
    .from(collectionItems)
    .where(
      and(
        inArray(
          collectionItems.collectionId,
          collectionRows.map((collection) => collection.id)
        ),
        eq(collectionItems.itemType, "photo")
      )
    );

  const photoIdsByCollection = new Map<string, string[]>();
  for (const item of items) {
    const bucket = photoIdsByCollection.get(item.collectionId);
    if (bucket) bucket.push(item.itemId);
    else photoIdsByCollection.set(item.collectionId, [item.itemId]);
  }

  return collectionRows.map((collection) => ({
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    kind: collection.kind,
    visibility: collection.visibility,
    photoIds: photoIdsByCollection.get(collection.id) || [],
    sharePath: getCollectionSharePath(collection),
  }));
}

export async function createCollectionAction(
  name: string,
  description?: string,
  color?: string,
  icon?: string,
  kind: CollectionKind = "media"
) {
  await ensureDbInitialized();
  const cleanName = name.trim();
  if (!cleanName) {
    return { success: false, error: "Collection name is required." };
  }
  if (!isCollectionKind(kind)) {
    return { success: false, error: "Invalid collection kind." };
  }

  const existing = await db
    .select()
    .from(collections)
    .where(eq(collections.name, cleanName))
    .limit(1);
  if (existing[0]) {
    return { success: true, id: existing[0].id, slug: existing[0].slug, existing: true };
  }

  const slug = await uniqueCollectionSlug(cleanName);
  const id = `col_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const now = nowIso();

  await db.insert(collections).values({
    id,
    name: cleanName,
    slug,
    description: description?.trim() || null,
    color: color || "#ff6600",
    icon: icon || "Folder",
    kind,
    visibility: "private",
    shareToken: null,
    coverPhotoId: null,
    createdAt: now,
    updatedAt: now,
  });

  purgeCollectionCaches({ id, slug });
  return { success: true, id, slug, existing: false };
}

export async function updateCollectionAction(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    color?: string | null;
    kind?: CollectionKind;
  }
) {
  await ensureDbInitialized();
  const current = await findCollection(id);
  if (!current) return { success: false, error: "Collection not found." };

  const updates: Partial<CollectionRecord> = { updatedAt: nowIso() };

  if (input.name !== undefined) {
    const cleanName = input.name.trim();
    if (!cleanName) return { success: false, error: "Collection name is required." };
    const duplicate = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.name, cleanName))
      .limit(1);
    if (duplicate[0] && duplicate[0].id !== id) {
      return { success: false, error: "A collection with that name already exists." };
    }
    updates.name = cleanName;
  }
  if (input.description !== undefined) {
    updates.description = input.description?.trim() || null;
  }
  if (input.color !== undefined) {
    updates.color = input.color?.trim() || null;
  }
  if (input.kind !== undefined) {
    if (!isCollectionKind(input.kind)) return { success: false, error: "Invalid collection kind." };
    updates.kind = input.kind;
  }

  await db.update(collections).set(updates).where(eq(collections.id, id));
  purgeCollectionCaches({ id, slug: current.slug });
  return { success: true };
}

export async function setCollectionVisibilityAction(id: string, visibility: CollectionVisibility) {
  await ensureDbInitialized();
  if (!isCollectionVisibility(visibility)) {
    return { success: false, error: "Invalid visibility." };
  }

  const current = await findCollection(id);
  if (!current) return { success: false, error: "Collection not found." };

  const shareToken =
    visibility === "unlisted" && !current.shareToken ? generateShareToken() : current.shareToken;

  await db
    .update(collections)
    .set({ visibility, shareToken, updatedAt: nowIso() })
    .where(eq(collections.id, id));

  const updated: CollectionRecord = { ...current, visibility, shareToken };
  purgeCollectionCaches({ id, slug: current.slug });
  return { success: true, sharePath: getCollectionSharePath(updated) };
}

export async function regenerateCollectionShareTokenAction(id: string) {
  await ensureDbInitialized();
  const current = await findCollection(id);
  if (!current) return { success: false, error: "Collection not found." };

  const shareToken = generateShareToken();
  await db
    .update(collections)
    .set({ shareToken, updatedAt: nowIso() })
    .where(eq(collections.id, id));

  const updated: CollectionRecord = { ...current, shareToken };
  purgeCollectionCaches({ id, slug: current.slug });
  return { success: true, sharePath: getCollectionSharePath(updated) };
}

export async function setCollectionCoverAction(collectionId: string, photoId: string | null) {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  if (!collection) return { success: false, error: "Collection not found." };

  if (photoId) {
    const membership = await db
      .select({ id: collectionItems.id })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collection.id),
          eq(collectionItems.itemType, "photo"),
          eq(collectionItems.itemId, photoId)
        )
      )
      .limit(1);
    if (!membership[0]) {
      return { success: false, error: "Choose a photo that belongs to this collection." };
    }
  }

  await db
    .update(collections)
    .set({ coverPhotoId: photoId, updatedAt: nowIso() })
    .where(eq(collections.id, collection.id));

  purgeCollectionCaches({ id: collection.id, slug: collection.slug });
  return { success: true, coverPhotoId: photoId };
}

export async function recordCollectionViewAction(
  key: string,
  token?: string | null,
  preview = false
) {
  await ensureDbInitialized();
  if (preview) return { success: true, counted: false };

  const collection = await findCollection(key);
  if (!collection) return { success: false, counted: false, error: "Collection not found." };

  if (collection.visibility !== "public" && collection.visibility !== "unlisted") {
    return { success: true, counted: false };
  }
  if (collection.visibility === "unlisted" && !tokensMatch(collection.shareToken, token)) {
    return { success: true, counted: false };
  }

  const now = nowIso();
  await db
    .insert(collectionAnalytics)
    .values({
      collectionId: collection.id,
      viewCount: 1,
      lastViewedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: collectionAnalytics.collectionId,
      set: {
        viewCount: sql`${collectionAnalytics.viewCount} + 1`,
        lastViewedAt: now,
        updatedAt: now,
      },
    });

  return { success: true, counted: true };
}

export async function deleteCollectionAction(id: string) {
  await ensureDbInitialized();
  const current = await findCollection(id);
  const collectionId = current?.id || id;
  await db
    .delete(collectionKnockoutVotes)
    .where(eq(collectionKnockoutVotes.collectionId, collectionId));
  await db
    .delete(collectionKnockoutRuns)
    .where(eq(collectionKnockoutRuns.collectionId, collectionId));
  await db.delete(collectionItems).where(eq(collectionItems.collectionId, collectionId));
  await db
    .delete(collectionAnalytics)
    .where(eq(collectionAnalytics.collectionId, collectionId));
  await db.delete(collections).where(eq(collections.id, collectionId));
  purgeTag("knockout-summary");
  purgeCollectionCaches({ id: collectionId, slug: current?.slug || null });
  return { success: true };
}

export async function addItemToCollectionAction(
  collectionId: string,
  itemType: string,
  itemId: string | number
) {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  if (!collection) return { success: false, error: "Collection not found." };
  if (!SUPPORTED_ITEM_TYPES.has(itemType)) {
    return { success: false, error: "Unsupported collection item type." };
  }
  if (!itemAllowedForKind(collection.kind, itemType)) {
    return {
      success: false,
      error:
        itemType === "photo"
          ? "Photos can only be added to photo or mixed collections."
          : "This item type cannot be added to a photo collection.",
    };
  }

  const itemIdStr = String(itemId);
  const id = `${collectionId}_${itemType}_${itemIdStr}`;
  await db
    .insert(collectionItems)
    .values({
      id,
      collectionId,
      itemType,
      itemId: itemIdStr,
      addedAt: nowIso(),
    })
    .onConflictDoNothing();

  await db
    .update(collections)
    .set({ updatedAt: nowIso() })
    .where(eq(collections.id, collectionId));

  purgeCollectionCaches({ id: collectionId, slug: collection.slug });
  return { success: true };
}

export async function removeItemFromCollectionAction(
  collectionId: string,
  itemType: string,
  itemId: string | number
) {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  const itemIdStr = String(itemId);
  const id = `${collectionId}_${itemType}_${itemIdStr}`;

  await db.delete(collectionItems).where(eq(collectionItems.id, id));
  if (collection) {
    const updates: Partial<CollectionRecord> = { updatedAt: nowIso() };
    if (
      itemType === "photo" &&
      collection.coverPhotoId &&
      collection.coverPhotoId === itemIdStr
    ) {
      updates.coverPhotoId = null;
    }
    await db.update(collections).set(updates).where(eq(collections.id, collectionId));
  }
  if (collection && itemType === "photo") {
    await db
      .delete(collectionKnockoutVotes)
      .where(
        and(
          eq(collectionKnockoutVotes.collectionId, collection.id),
          or(
            eq(collectionKnockoutVotes.winnerPhotoId, itemIdStr),
            eq(collectionKnockoutVotes.loserPhotoId, itemIdStr)
          )
        )
      );
    await db
      .delete(collectionKnockoutRuns)
      .where(
        and(
          eq(collectionKnockoutRuns.collectionId, collection.id),
          eq(collectionKnockoutRuns.championPhotoId, itemIdStr)
        )
      );
    purgeTag("knockout-summary");
  }
  purgeCollectionCaches({ id: collectionId, slug: collection?.slug || null });
  return { success: true };
}

export async function addPhotosToCollectionAction(collectionId: string, photoIds: string[]) {
  await ensureDbInitialized();
  const collection = await findCollection(collectionId);
  if (!collection) return { success: false, error: "Collection not found." };
  if (!isItemTypeAllowedForKind(collection.kind, "photo")) {
    return { success: false, error: "Photos can only be added to photo or mixed collections." };
  }

  const uniqueIds = Array.from(new Set(photoIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { success: true, count: 0 };

  const existingPhotos = await db
    .select({ id: gallery.id })
    .from(gallery)
    .where(inArray(gallery.id, uniqueIds));
  const validIds = existingPhotos.map((photo) => photo.id);
  const now = nowIso();

  if (validIds.length > 0) {
    await db
      .insert(collectionItems)
      .values(
        validIds.map((photoId) => ({
          id: `${collectionId}_photo_${photoId}`,
          collectionId,
          itemType: "photo",
          itemId: photoId,
          addedAt: now,
        }))
      )
      .onConflictDoNothing();
  }

  if (validIds.length > 0) {
    await db
      .update(collections)
      .set({ updatedAt: now })
      .where(eq(collections.id, collectionId));
  }

  purgeCollectionCaches({ id: collectionId, slug: collection.slug });
  return { success: true, count: validIds.length };
}

export async function removePhotoFromCollectionAction(collectionId: string, photoId: string) {
  return removeItemFromCollectionAction(collectionId, "photo", photoId);
}

export async function getCollectionDetailAction(key: string): Promise<CollectionDetail | null> {
  await ensureDbInitialized();
  const collection = await findCollection(key);
  if (!collection) return null;

  const items = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collection.id));
  const data = await loadCollectionItemData(items);
  const analytics =
    (await loadAnalyticsSummaries([collection.id])).get(collection.id) || EMPTY_ANALYTICS;
  return buildCollectionDetail(collection, items, data, false, analytics);
}

const getPublicCollectionCached = createCachedQuery(
  async (slug: string, token?: string | null): Promise<PublicCollectionDetail | null> => {
    await ensureDbInitialized();
    const collection = await findCollection(slug);
    if (!collection) return null;

    if (collection.visibility !== "public" && collection.visibility !== "unlisted") return null;
    if (collection.visibility === "unlisted" && !tokensMatch(collection.shareToken, token)) {
      return null;
    }

    const items = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collection.id));
    const data = await loadCollectionItemData(items);
    return toPublicDetail(buildCollectionDetail(collection, items, data, true));
  },
  ["public-collection-detail"],
  { tags: ["collections-public"], revalidate: 60 }
);

export async function getPublicCollectionAction(
  slug: string,
  token?: string | null
): Promise<PublicCollectionDetail | null> {
  return getPublicCollectionCached(slug, token);
}

export async function getItemCollectionsAction(
  itemType: string,
  itemId: string | number
): Promise<CollectionRecord[]> {
  await ensureDbInitialized();
  const itemIdStr = String(itemId);

  const items = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.itemType, itemType), eq(collectionItems.itemId, itemIdStr)));

  if (items.length === 0) return [];

  const collectionIds = Array.from(new Set(items.map((item) => item.collectionId)));
  return db
    .select()
    .from(collections)
    .where(inArray(collections.id, collectionIds))
    .orderBy(desc(collections.createdAt));
}
