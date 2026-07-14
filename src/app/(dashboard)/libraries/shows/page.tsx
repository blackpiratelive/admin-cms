import React from "react";
import { getShowsAction } from "@/features/libraries/actions/shows";
import { ShowCard } from "@/features/libraries/components/ShowCard";
import { GlobalSearchModal } from "@/features/libraries/components/GlobalSearchModal";
import { Tv, Filter } from "lucide-react";

export const metadata = {
  title: "TV Shows Library - Admin CMS",
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    fav?: string;
    status?: string;
    sort?: "title" | "year" | "updated_at";
  }>;
}

export default async function ShowsLibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const shows = await getShowsAction({
    query: params.q,
    favorite: params.fav === "true",
    status: params.status,
    sortBy: params.sort || "title",
  });

  return (
    <div style={{ paddingBottom: "60px" }}>
      <GlobalSearchModal />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Tv size={24} style={{ color: "var(--accent-color)" }} /> TV Shows Library
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Canonical TV Shows synced from Trakt. Track watched seasons, episodes, and personal series ratings.
          </p>
        </div>

        <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
          {shows.length} TV Shows Total
        </div>
      </div>

      {/* Filter Toolbar */}
      <form method="GET" className="card" style={{ padding: "12px 16px", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            name="q"
            defaultValue={params.q || ""}
            placeholder="Search TV shows by title or notes..."
            className="text-input"
            style={{ fontSize: "13px" }}
          />
        </div>

        <select name="status" defaultValue={params.status || ""} className="select-input" style={{ width: "auto", fontSize: "12px" }}>
          <option value="">All Statuses</option>
          <option value="returning series">Returning Series</option>
          <option value="ended">Ended</option>
          <option value="canceled">Canceled</option>
        </select>

        <select name="sort" defaultValue={params.sort || "title"} className="select-input" style={{ width: "auto", fontSize: "12px" }}>
          <option value="title">Sort by Title</option>
          <option value="year">Sort by Release Year</option>
          <option value="updated_at">Sort by Last Updated</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer" }}>
          <input type="checkbox" name="fav" value="true" defaultChecked={params.fav === "true"} />
          <span>Favorites Only</span>
        </label>

        <button type="submit" className="btn btn-sm btn-primary">
          <Filter size={14} /> Apply Filter
        </button>
      </form>

      {/* Shows Grid */}
      {shows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <h3>No TV shows matching current filters.</h3>
          <p style={{ fontSize: "13px" }}>Sync your Trakt account to import TV show watch history.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
          {shows.map((showData) => (
            <ShowCard key={showData.show.traktId} showData={showData} />
          ))}
        </div>
      )}
    </div>
  );
}
