"use server";

import { getMoviesAction } from "./movies";
import { getShowsAction } from "./shows";
import { getArtistsAction, getAlbumsAction, getTracksAction } from "./music";
import { GlobalSearchResult } from "../types";

export async function globalSearchAction(query: string): Promise<GlobalSearchResult> {
  if (!query || query.trim().length < 2) {
    return {
      movies: [],
      shows: [],
      artists: [],
      albums: [],
      tracks: [],
    };
  }

  const q = query.trim();

  const [movies, shows, artists, albums, tracks] = await Promise.all([
    getMoviesAction({ query: q }),
    getShowsAction({ query: q }),
    getArtistsAction({ query: q }),
    getAlbumsAction({ query: q }),
    getTracksAction({ query: q }),
  ]);

  return {
    movies: movies.slice(0, 5),
    shows: shows.slice(0, 5),
    artists: artists.slice(0, 5),
    albums: albums.slice(0, 5),
    tracks: tracks.slice(0, 5),
  };
}
