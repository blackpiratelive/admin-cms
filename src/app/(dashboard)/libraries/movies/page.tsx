import React from "react";
import { getPaginatedMoviesAction } from "@/features/libraries/actions/movies";
import { MoviesList } from "@/features/libraries/components/MoviesList";
import { GlobalSearchModal } from "@/features/libraries/components/GlobalSearchModal";
import { Film } from "lucide-react";

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

  const initialData = await getPaginatedMoviesAction({
    query: params.q,
    favorite: params.fav === "true",
    reviewed: params.reviewed,
    genre: params.genre,
    tag: params.tag,
    timeframe: params.timeframe,
    sortBy: params.sort || "watched_at",
    page: 1,
    limit: 25,
  });

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
      </div>

      {/* Paginated & Filtered Movies List */}
      <MoviesList
        initialData={initialData}
        initialParams={{
          query: params.q,
          favorite: params.fav === "true",
          reviewed: params.reviewed,
          genre: params.genre,
          tag: params.tag,
          timeframe: params.timeframe,
          sortBy: params.sort || "watched_at",
        }}
      />
    </div>
  );
}
