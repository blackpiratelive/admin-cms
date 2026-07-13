import React from "react";
import { getGalleryPhotos } from "@/features/gallery/actions";
import { GalleryUploader } from "@/features/gallery/GalleryUploader";
import { GalleryGrid } from "@/features/gallery/GalleryGrid";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const initialPhotos = await getGalleryPhotos();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="page-header">
        <h1 className="page-title">Photo Gallery Pipeline</h1>
      </div>

      {/* Upload Zone & Desktop Inspector */}
      <GalleryUploader />

      {/* Gallery Portfolio Grid */}
      <div style={{ marginTop: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "12px", paddingBottom: "6px", borderBottom: "1px solid var(--border-color)" }}>
          Uploaded Photo Portfolio ({initialPhotos.length})
        </h2>
        <GalleryGrid initialPhotos={initialPhotos} />
      </div>
    </div>
  );
}
