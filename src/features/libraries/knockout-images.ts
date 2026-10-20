import { createHmac, timingSafeEqual } from "crypto";

/**
 * Opaque image URLs for the blind Best Pic Knockout arena.
 *
 * Gallery derivative URLs contain the human-readable folder slug (derived from
 * the photo title) and the capture year/month. Exposing those URLs before the
 * reveal would leak title/date information, so the deck receives signed proxy
 * URLs instead. The proxy resolves the real URL only after verifying that the
 * signature matches the photo, collection, and requested size.
 */

export const KNOCKOUT_IMAGE_SIZES = ["thumbnail", "medium", "large"] as const;
export type KnockoutImageSize = (typeof KNOCKOUT_IMAGE_SIZES)[number];

const KNOCKOUT_IMAGE_SECRET =
  process.env.KNOCKOUT_IMAGE_SECRET ||
  process.env.SESSION_SECRET ||
  "admin-cms-super-secret-key-32charsmin!!";

const KNOCKOUT_IMAGE_KEY = createHmac("sha256", KNOCKOUT_IMAGE_SECRET)
  .update("best-pic-knockout-image")
  .digest();

function signatureFor(
  collectionId: string,
  photoId: string,
  size: KnockoutImageSize
): string {
  return createHmac("sha256", KNOCKOUT_IMAGE_KEY)
    .update(`knockout-image:${collectionId}:${photoId}:${size}`)
    .digest("hex")
    .slice(0, 32);
}

export function isKnockoutImageSize(
  value: string | null | undefined
): value is KnockoutImageSize {
  return (
    value === "thumbnail" || value === "medium" || value === "large"
  );
}

export function knockoutImagePath(
  collectionId: string,
  photoId: string,
  size: KnockoutImageSize
): string {
  const params = new URLSearchParams({
    collection: collectionId,
    photo: photoId,
    size,
    sig: signatureFor(collectionId, photoId, size),
  });
  return `/api/gallery/knockout-image?${params.toString()}`;
}

export function verifyKnockoutImageSignature(
  collectionId: string,
  photoId: string,
  size: KnockoutImageSize,
  signature: string
): boolean {
  const expected = signatureFor(collectionId, photoId, size);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
