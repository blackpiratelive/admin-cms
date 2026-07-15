import React from "react";
import { getPaginatedShowsAction } from "@/features/libraries/actions/shows";
import { ShowsList } from "@/features/libraries/components/ShowsList";
import { GlobalSearchModal } from "@/features/libraries/components/GlobalSearchModal";
import { Tv } from "lucide-react";

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

  const initialData = await getPaginatedShowsAction({
    query: params.q,
    favorite: params.fav === "true",
    status: params.status,
    sortBy: params.sort || "title",
    page: 1,
    limit: 25,
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
      </div>

      {/* Paginated & Filtered Shows List */}
      <ShowsList
        initialData={initialData}
        initialParams={{
          query: params.q,
          favorite: params.fav === "true",
          status: params.status,
          sortBy: params.sort || "title",
        }}
      />
    </div>
  );
}
