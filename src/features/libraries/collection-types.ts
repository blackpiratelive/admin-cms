import type { CollectionRecord } from "@/db/schema";

export interface CollectionCounts {
  photos: number;
  movies: number;
  shows: number;
  artists: number;
  albums: number;
  tracks: number;
  people: number;
  total: number;
}

export interface CollectionAnalyticsSummary {
  viewCount: number;
  lastViewedAt: string | null;
}

export interface CollectionOverview extends CollectionRecord {
  counts: CollectionCounts;
  coverUrl: string | null;
  sharePath: string | null;
  analytics: CollectionAnalyticsSummary;
}

export type PublicCollectionOverview = Omit<
  CollectionOverview,
  "coverPhotoId" | "shareToken" | "analytics"
> & {
  shareToken: null;
};

export interface CollectionPhotoItem {
  itemType: "photo";
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  mediumUrl: string;
  largeUrl: string;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  createdAt: string;
  visibility: string;
  camera: string | null;
  lens: string | null;
  focalLength: string | null;
  aperture: string | null;
  shutterSpeed: string | null;
  iso: number | null;
  locationName: string | null;
  addedAt: string;
  incompatible?: boolean;
}

export interface CollectionMovieItem {
  itemType: "movie";
  id: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
  favorite: boolean;
  rating: number | null;
  review: string | null;
  visibility: string;
  addedAt: string;
  incompatible?: boolean;
}

export interface CollectionShowItem {
  itemType: "show";
  id: string;
  title: string;
  year: number | null;
  status: string | null;
  posterUrl: string | null;
  overview: string | null;
  favorite: boolean;
  rating: number | null;
  review: string | null;
  visibility: string;
  addedAt: string;
  incompatible?: boolean;
}

export interface CollectionArtistItem {
  itemType: "artist";
  id: string;
  name: string;
  playCount: number;
  favorite: boolean;
  rating: number | null;
  review: string | null;
  visibility: string;
  addedAt: string;
  incompatible?: boolean;
}

export interface CollectionAlbumItem {
  itemType: "album";
  id: string;
  name: string;
  artist: string;
  playCount: number;
  favorite: boolean;
  rating: number | null;
  review: string | null;
  visibility: string;
  addedAt: string;
  incompatible?: boolean;
}

export interface CollectionTrackItem {
  itemType: "track";
  id: string;
  name: string;
  artist: string;
  playCount: number;
  favorite: boolean;
  rating: number | null;
  review: string | null;
  visibility: string;
  addedAt: string;
  incompatible?: boolean;
}

export interface CollectionPersonItem {
  itemType: "person";
  id: string;
  name: string;
  avatarUrl: string | null;
  visibility: string;
  addedAt: string;
  incompatible?: boolean;
}

export type CollectionMediaItem =
  | CollectionMovieItem
  | CollectionShowItem
  | CollectionArtistItem
  | CollectionAlbumItem
  | CollectionTrackItem
  | CollectionPersonItem;

export interface CollectionDetail {
  collection: CollectionRecord;
  photos: CollectionPhotoItem[];
  movies: CollectionMovieItem[];
  shows: CollectionShowItem[];
  artists: CollectionArtistItem[];
  albums: CollectionAlbumItem[];
  tracks: CollectionTrackItem[];
  people: CollectionPersonItem[];
  unsupportedCount: number;
  incompatibleCount: number;
  counts: CollectionCounts;
  coverUrl: string | null;
  sharePath: string | null;
  analytics: CollectionAnalyticsSummary;
}

export type PublicCollectionDetail = Omit<
  CollectionDetail,
  "analytics" | "collection" | "incompatibleCount"
> & {
  collection: Omit<CollectionRecord, "coverPhotoId" | "shareToken"> & { shareToken: null };
};

export interface CollectionPhotoPickerOption {
  id: string;
  name: string;
  slug: string;
  kind: string;
  visibility: string;
  photoIds: string[];
  sharePath: string | null;
}

export function emptyCollectionCounts(): CollectionCounts {
  return {
    photos: 0,
    movies: 0,
    shows: 0,
    artists: 0,
    albums: 0,
    tracks: 0,
    people: 0,
    total: 0,
  };
}

export function sumCollectionCounts(counts: CollectionCounts): number {
  return (
    counts.photos +
    counts.movies +
    counts.shows +
    counts.artists +
    counts.albums +
    counts.tracks +
    counts.people
  );
}
