import React from "react";
import { getCollectionsAction } from "@/features/libraries/actions/collections";
import { CollectionsManager } from "@/features/libraries/components/CollectionsManager";
import { Folder } from "lucide-react";

export const metadata = {
  title: "Media Collections - Admin CMS",
};

export default async function CollectionsPage() {
  const collections = await getCollectionsAction();

  return (
    <div style={{ paddingBottom: "60px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
          <Folder size={24} style={{ color: "var(--accent-color)" }} /> Media Collections
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
          Group Movies, TV Shows, Artists, Albums, and Tracks into custom curated collections.
        </p>
      </div>

      <CollectionsManager collections={collections} />
    </div>
  );
}
