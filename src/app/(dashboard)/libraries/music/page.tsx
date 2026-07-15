import React from "react";
import {
  getPaginatedArtistsAction,
  getPaginatedAlbumsAction,
  getPaginatedTracksAction,
  getPaginatedHistoryAction,
} from "@/features/libraries/actions/music";
import { MusicTabs } from "@/features/libraries/components/MusicTabs";
import { GlobalSearchModal } from "@/features/libraries/components/GlobalSearchModal";
import { Music } from "lucide-react";

export const metadata = {
  title: "Music Library - Admin CMS",
};

interface PageProps {
  searchParams: Promise<{
    tab?: "artists" | "albums" | "tracks" | "history";
  }>;
}

export default async function MusicLibraryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeTab = params.tab || "artists";

  const [artistsRes, albumsRes, tracksRes, historyRes] = await Promise.all([
    getPaginatedArtistsAction({ page: 1, limit: 25 }),
    getPaginatedAlbumsAction({ page: 1, limit: 25 }),
    getPaginatedTracksAction({ page: 1, limit: 25 }),
    getPaginatedHistoryAction({ page: 1, limit: 25 }),
  ]);

  return (
    <div style={{ paddingBottom: "60px" }}>
      <GlobalSearchModal />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
            <Music size={24} style={{ color: "var(--accent-color)" }} /> Music Library
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Canonical music listening history synced from Last.fm. Explore Artists, Albums, Tracks, and Scrobbles Timeline.
          </p>
        </div>
      </div>

      <MusicTabs
        initialArtists={artistsRes}
        initialAlbums={albumsRes}
        initialTracks={tracksRes}
        initialHistory={historyRes}
        activeTab={activeTab}
      />
    </div>
  );
}
