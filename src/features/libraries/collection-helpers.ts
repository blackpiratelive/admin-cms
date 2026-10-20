import type { CollectionRecord } from "@/db/schema";

export type CollectionKind = "photo" | "media" | "mixed";
export type CollectionVisibility = "private" | "unlisted" | "public";

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
