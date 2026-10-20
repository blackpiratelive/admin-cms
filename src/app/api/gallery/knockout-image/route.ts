import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, ensureDbInitialized } from "@/db";
import { collectionItems, collections, gallery } from "@/db/schema";
import {
  isKnockoutImageSize,
  verifyKnockoutImageSignature,
} from "@/features/libraries/knockout-images";

export const runtime = "nodejs";

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Blind-image proxy for Best Pic Knockout.
 *
 * The client only ever sees a signed, opaque URL. The real gallery derivative
 * URL (which contains the title-derived folder slug and capture date) is
 * resolved here after the signature, album membership, and visibility checks
 * pass. `preview=1` runs still use this route; the signature is only issued by
 * the deck action after its own access checks.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const collectionId = params.get("collection");
  const photoId = params.get("photo");
  const size = params.get("size");
  const signature = params.get("sig");

  if (
    !collectionId ||
    !photoId ||
    !signature ||
    !isKnockoutImageSize(size) ||
    !verifyKnockoutImageSignature(collectionId, photoId, size, signature)
  ) {
    return notFound();
  }

  await ensureDbInitialized();

  const urlColumn =
    size === "thumbnail"
      ? gallery.thumbnailUrl
      : size === "medium"
        ? gallery.mediumUrl
        : gallery.largeUrl;

  const rows = await db
    .select({ url: urlColumn })
    .from(gallery)
    .innerJoin(
      collectionItems,
      and(
        eq(collectionItems.itemId, gallery.id),
        eq(collectionItems.itemType, "photo")
      )
    )
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(
      and(
        eq(gallery.id, photoId),
        eq(collections.id, collectionId),
        eq(collections.kind, "photo"),
        eq(collections.knockoutEnabled, 1),
        inArray(collections.visibility, ["public", "unlisted"]),
        inArray(gallery.visibility, ["public", "unlisted"])
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return notFound();

  const upstreamUrl = row.url.startsWith("http")
    ? row.url
    : new URL(row.url, request.nextUrl.origin).toString();

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: { Accept: "image/*" },
    });
  } catch {
    return notFound();
  }

  if (!upstream.ok || !upstream.body) return notFound();

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return notFound();

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=3600"
  );
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(upstream.body, { status: 200, headers });
}
