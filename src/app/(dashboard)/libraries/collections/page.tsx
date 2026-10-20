import React from "react";
import { getCollectionsOverviewAction } from "@/features/libraries/actions/collections";
import { CollectionsManager } from "@/features/libraries/components/CollectionsManager";
import { Folder } from "lucide-react";

export const metadata = {
  title: "Collections - Admin CMS",
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await getCollectionsOverviewAction();

  return (
    <div style={{ paddingBottom: "60px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
          <Folder size={24} style={{ color: "var(--accent-color)" }} /> Collections
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
          Build photo albums or curated media collections, then share them as a private, unlisted, or public link.
        </p>
      </div>

      <CollectionsManager collections={collections} />
    </div>
  );
}
