import React from "react";
import { getArtistsAction, getAlbumsAction, getTracksAction, getListeningHistoryAction } from "@/features/libraries/actions/music";
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

  const [artists, albums, tracks, history] = await Promise.all([
    getArtistsAction(),
    getAlbumsAction(),
    getTracksAction(),
    getListeningHistoryAction({ limit: 100 }),
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
        artists={artists}
        albums={albums}
        tracks={tracks}
        history={history}
        activeTab={activeTab}
      />
    </div>
  );
}
