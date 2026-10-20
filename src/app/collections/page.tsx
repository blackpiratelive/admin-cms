import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { getPublicCollectionsAction } from "@/features/libraries/actions/collections";
import { collectionKindLabel } from "@/features/libraries/collection-helpers";
import type { CollectionOverview } from "@/features/libraries/collection-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Collections" },
  description: "A curated collection of photographs, films, music, and people.",
};

function countSummary(collection: CollectionOverview): string {
  const parts: string[] = [];
  if (collection.counts.photos) {
    parts.push(`${collection.counts.photos} photo${collection.counts.photos === 1 ? "" : "s"}`);
  }
  const screenItems = collection.counts.movies + collection.counts.shows;
  if (screenItems) parts.push(`${screenItems} film${screenItems === 1 ? "" : "s"}`);
  const musicItems = collection.counts.artists + collection.counts.albums + collection.counts.tracks;
  if (musicItems) parts.push(`${musicItems} music item${musicItems === 1 ? "" : "s"}`);
  if (collection.counts.people) {
    parts.push(`${collection.counts.people} ${collection.counts.people === 1 ? "person" : "people"}`);
  }
  return parts.length ? parts.join(" · ") : "Nothing shared yet";
}

export default async function PublicCollectionsPage() {
  const collections = await getPublicCollectionsAction();

  return (
    <main className="public-collections-page">
      <header className="public-collections-header">
        <div>
          <div className="public-collections-eyebrow">
            <FolderOpen size={14} /> Curated collections
          </div>
          <h1 className="public-collections-title">Collections</h1>
          <p className="public-collections-subtitle">
            Photographs, films, music, and people gathered into small, deliberate stories.
          </p>
        </div>
      </header>

      {collections.length === 0 ? (
        <div className="public-collections-empty">
          <FolderOpen size={32} />
          <h2>No public collections yet</h2>
          <p>Shared collections will appear here once they are published.</p>
        </div>
      ) : (
        <div className="public-collection-index-grid">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.slug}`}
              className="public-collection-index-card"
            >
              <div
                className="public-collection-index-cover"
                style={
                  collection.coverUrl
                    ? undefined
                    : {
                        background: `linear-gradient(135deg, ${collection.color || "#ff6600"}33, #18181b 70%)`,
                      }
                }
              >
                {collection.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={collection.coverUrl} alt="" loading="lazy" />
                ) : (
                  <FolderOpen size={30} />
                )}
              </div>
              <div className="public-collection-index-body">
                <div className="public-collection-index-meta">
                  <span className="public-collection-kind-badge">
                    {collectionKindLabel(collection.kind)}
                  </span>
                  <ArrowUpRight size={15} />
                </div>
                <h2>{collection.name}</h2>
                {collection.description && <p>{collection.description}</p>}
                <div className="public-collection-index-counts">{countSummary(collection)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <footer className="public-collections-footer">
        <span>Stories worth keeping.</span>
      </footer>
    </main>
  );
}
