import {
  TraktMovieRecord,
  TraktShowRecord,
  TraktEpisodeRecord,
  LastfmArtistRecord,
  LastfmAlbumRecord,
  LastfmTrackRecord,
  LastfmScrobbleRecord,
  MovieMetadataRecord,
  TvShowMetadataRecord,
  ArtistMetadataRecord,
  AlbumMetadataRecord,
  TrackMetadataRecord,
  CollectionRecord,
  ActivityRecord,
} from "@/db/schema";

export interface CombinedMovie {
  movie: TraktMovieRecord;
  metadata: MovieMetadataRecord | null;
  collections: CollectionRecord[];
}

export interface CombinedShow {
  show: TraktShowRecord;
  metadata: TvShowMetadataRecord | null;
  episodes: TraktEpisodeRecord[];
  collections: CollectionRecord[];
}

export interface CombinedArtist {
  artist: LastfmArtistRecord;
  metadata: ArtistMetadataRecord | null;
  collections: CollectionRecord[];
}

export interface CombinedAlbum {
  album: LastfmAlbumRecord;
  metadata: AlbumMetadataRecord | null;
  collections: CollectionRecord[];
}

export interface CombinedTrack {
  track: LastfmTrackRecord;
  metadata: TrackMetadataRecord | null;
  collections: CollectionRecord[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MovieFilterOptions {
  query?: string;
  favorite?: boolean;
  reviewed?: "all" | "reviewed" | "unreviewed";
  genre?: string;
  tag?: string;
  visibility?: string;
  timeframe?: "all" | "recently_watched" | "this_year" | "last_month";
  year?: number;
  minRating?: number;
  sortBy?: "watched_at" | "title" | "year" | "rating" | "personal_rating";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ShowFilterOptions {
  query?: string;
  favorite?: boolean;
  status?: string;
  genre?: string;
  tag?: string;
  visibility?: string;
  minRating?: number;
  sortBy?: "updated_at" | "title" | "year";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface MusicFilterOptions {
  query?: string;
  favorite?: boolean;
  tag?: string;
  timeframe?: "all" | "today" | "yesterday" | "this_week" | "this_month";
  sortBy?: "play_count" | "name" | "last_played";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface GlobalSearchResult {
  movies: CombinedMovie[];
  shows: CombinedShow[];
  artists: CombinedArtist[];
  albums: CombinedAlbum[];
  tracks: CombinedTrack[];
}
