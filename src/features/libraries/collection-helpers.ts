import type { CollectionRecord } from "@/db/schema";
import type { CollectionOverview } from "./collection-types";

export type CollectionKind = "photo" | "media" | "mixed";
export type CollectionVisibility = "private" | "unlisted" | "public";
export type CollectionKindFilter = "all" | CollectionKind;
export type CollectionVisibilityFilter = "all" | CollectionVisibility;
export type CollectionSort = "updated" | "name" | "items" | "views";
export type CollectionViewMode = "grid" | "list";

export const COLLECTION_KINDS: CollectionKind[] = ["photo", "media", "mixed"];
export const COLLECTION_VISIBILITIES: CollectionVisibility[] = ["private", "unlisted", "public"];

export const PHOTO_ITEM_TYPES = ["photo"] as const;
export const MEDIA_ITEM_TYPES = ["movie", "show", "artist", "album", "track", "person"] as const;

export function isCollectionKind(value: unknown): value is CollectionKind {
  return typeof value === "string" && (COLLECTION_KINDS as string[]).includes(value);
}

export function isCollectionVisibility(value: unknown): value is CollectionVisibility {
  return typeof value === "string" && (COLLECTION_VISIBILITIES as string[]).includes(value);
}

export function slugifyCollectionName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "collection";
}

export function collectionKindLabel(kind: string | null | undefined): string {
  switch (kind) {
    case "photo":
      return "Photo album";
    case "mixed":
      return "Mixed collection";
    default:
      return "Media collection";
  }
}

export function collectionVisibilityLabel(visibility: string | null | undefined): string {
  switch (visibility) {
    case "public":
      return "Public";
    case "unlisted":
      return "Unlisted";
    default:
      return "Private";
  }
}

export function collectionAllowsPhotos(kind: string | null | undefined): boolean {
  return kind === "photo" || kind === "mixed";
}

export function collectionAllowsMedia(kind: string | null | undefined): boolean {
  return kind === "media" || kind === "mixed";
}

export function isItemTypeAllowedForKind(kind: string | null | undefined, itemType: string): boolean {
  if (itemType === "photo") return collectionAllowsPhotos(kind);
  if ((MEDIA_ITEM_TYPES as readonly string[]).includes(itemType)) {
    return collectionAllowsMedia(kind);
  }
  return false;
}

export function getCollectionSharePath(
  collection: Pick<CollectionRecord, "slug" | "visibility" | "shareToken">
): string | null {
  if (collection.visibility === "unlisted") {
    return collection.shareToken
      ? `/collections/${collection.slug}?share=${collection.shareToken}`
      : null;
  }
  if (collection.visibility === "public") {
    return `/collections/${collection.slug}`;
  }
  return null;
}

export function getCollectionPreviewPath(sharePath: string): string {
  return `${sharePath}${sharePath.includes("?") ? "&" : "?"}preview=1`;
}

export function collectionCountLabel(collection: Pick<CollectionOverview, "counts">): string {
  const { counts } = collection;
  const parts: string[] = [];
  if (counts.photos) parts.push(`${counts.photos} photo${counts.photos === 1 ? "" : "s"}`);
  const films = counts.movies + counts.shows;
  if (films) parts.push(`${films} film${films === 1 ? "" : "s"}`);
  const music = counts.artists + counts.albums + counts.tracks;
  if (music) parts.push(`${music} music item${music === 1 ? "" : "s"}`);
  if (counts.people) parts.push(`${counts.people} ${counts.people === 1 ? "person" : "people"}`);
  return parts.join(" · ") || "Empty";
}

export function formatViewCount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}

export function formatRelativeDate(
  value: string | null | undefined,
  now: number = Date.now()
): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const elapsed = Math.max(0, now - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatCollectionDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function filterAndSortCollections(
  collections: CollectionOverview[],
  options: {
    query: string;
    kind: CollectionKindFilter;
    visibility: CollectionVisibilityFilter;
    sort: CollectionSort;
  }
): CollectionOverview[] {
  const query = options.query.trim().toLowerCase();
  const filtered = collections.filter((collection) => {
    if (options.kind !== "all" && collection.kind !== options.kind) return false;
    if (options.visibility !== "all" && collection.visibility !== options.visibility) return false;
    if (!query) return true;
    return (
      collection.name.toLowerCase().includes(query) ||
      (collection.description || "").toLowerCase().includes(query)
    );
  });

  return filtered.sort((a, b) => {
    switch (options.sort) {
      case "name":
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      case "items":
        return b.counts.total - a.counts.total || a.name.localeCompare(b.name);
      case "views":
        return b.analytics.viewCount - a.analytics.viewCount || a.name.localeCompare(b.name);
      case "updated":
      default:
        return b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name);
    }
  });
}

export function selectFeaturedCollection(
  collections: CollectionOverview[]
): CollectionOverview | null {
  if (collections.length === 0) return null;
  return collections.reduce((featured, collection) => {
    const updated = collection.updatedAt.localeCompare(featured.updatedAt);
    if (updated > 0) return collection;
    if (updated === 0 && collection.createdAt.localeCompare(featured.createdAt) > 0) {
      return collection;
    }
    return featured;
  });
}
