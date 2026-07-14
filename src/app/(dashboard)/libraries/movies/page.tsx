import React from "react";
import { getMoviesAction, bulkUpdateMoviesAction } from "@/features/libraries/actions/movies";
import { getCollectionsAction } from "@/features/libraries/actions/collections";
import { MovieCard } from "@/features/libraries/components/MovieCard";
import { BulkActionsBar } from "@/features/libraries/components/BulkActionsBar";
import { GlobalSearchModal } from "@/features/libraries/components/GlobalSearchModal";
import { Film, Search, Filter } from "lucide-react";

export const metadata = {
  title: "Movies Library - Admin CMS",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    fav?: string;
    reviewed?: "all" | "reviewed" | "unreviewed";
    genre?: string;
    tag?: string;
    timeframe?: "all" | "recently_watched" | "this_year" | "last_month";
    sort?: "watched_at" | "title" | "year" | "rating" | "personal_rating";
  }>;
}

export default async function MoviesLibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const movies = await getMoviesAction({
    query: params.q,
    favorite: params.fav === "true",
    reviewed: params.reviewed,
    genre: params.genre,
    tag: params.tag,
    timeframe: params.timeframe,
    sortBy: params.sort || "watched_at",
  });

  const collections = await getCollectionsAction();

  return (
    <div style={{ paddingBottom: "60px" }}>
      <GlobalSearchModal />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Film size={24} style={{ color: "var(--accent-color)" }} /> Movies Library
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Canonical movies synced from Trakt. Enrich with your personal metadata, ratings, reviews, and tags.
          </p>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
          {movies.length} Movies Total
        </div>
      </div>

      {/* Filter Toolbar */}
      <form method="GET" className="card" style={{ padding: "12px 16px", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            name="q"
            defaultValue={params.q || ""}
            placeholder="Search movies by title, notes, or reviews..."
            className="text-input"
            style={{ fontSize: "13px" }}
          />
        </div>

        <select name="timeframe" defaultValue={params.timeframe || "all"} className="select-input" style={{ width: "auto", fontSize: "12px" }}>
          <option value="all">All Timeframes</option>
          <option value="recently_watched">Recently Watched</option>
          <option value="this_year">Watched This Year</option>
          <option value="last_month">Watched Last Month</option>
        </select>

        <select name="reviewed" defaultValue={params.reviewed || "all"} className="select-input" style={{ width: "auto", fontSize: "12px" }}>
          <option value="all">All Review States</option>
          <option value="reviewed">Reviewed</option>
          <option value="unreviewed">Unreviewed</option>
        </select>

        <select name="sort" defaultValue={params.sort || "watched_at"} className="select-input" style={{ width: "auto", fontSize: "12px" }}>
          <option value="watched_at">Sort by Watched Date</option>
          <option value="title">Sort by Title</option>
          <option value="year">Sort by Release Year</option>
          <option value="rating">Sort by Provider Rating</option>
          <option value="personal_rating">Sort by Personal Rating</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
          <input type="checkbox" name="fav" value="true" defaultChecked={params.fav === "true"} />
          <span>Favorites Only</span>
        </label>

        <button type="submit" className="btn btn-sm btn-primary">
          <Filter size={14} /> Apply Filter
        </button>
      </form>

      {/* Movies Grid */}
      {movies.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <h3>No movies matching current filters.</h3>
          <p style={{ fontSize: "13px" }}>Try adjusting your search filters or sync your Trakt account in Sync Center.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
          {movies.map((movieData) => (
            <MovieCard key={movieData.movie.traktId} movieData={movieData} />
          ))}
        </div>
      )}
    </div>
  );
}
