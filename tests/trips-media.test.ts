import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import { trips, tripDays, gallery, attachments, relationships } from "../src/db/schema";
import { eq, or } from "drizzle-orm";
import {
  getTripHubDataAction,
  connectTripPhotosBatchAction,
  removeTripPhotoConnectionAction,
} from "../src/features/trips/actions";

const TEST_TRIP_ID = "trip_test_media_alps";
const TEST_TRIP_SLUG = "test-alps-media";
const TEST_GALLERY_ID = "gal_test_media_matterhorn";
const TEST_TRIP_DAY_ID = "tripday_test_media_day1";

describe("Trip Entity: 3-Tab Photo Picker Batch Connect & Disconnect", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    await db
      .insert(trips)
      .values({
        id: TEST_TRIP_ID,
        title: "Swiss Alps Expedition",
        slug: TEST_TRIP_SLUG,
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        status: "completed",
        visibility: "public",
        favorite: 0,
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    await db
      .insert(gallery)
      .values({
        id: TEST_GALLERY_ID,
        title: "Matterhorn at Dawn",
        slug: "matterhorn-at-dawn-media",
        originalUrl: "https://example.com/matterhorn.jpg",
        largeUrl: "https://example.com/matterhorn-lg.jpg",
        mediumUrl: "https://example.com/matterhorn-md.jpg",
        thumbnailUrl: "https://example.com/matterhorn-sm.jpg",
        visibility: "public",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // Trip day carrying an inline itinerary photo (photosJson)
    await db
      .insert(tripDays)
      .values({
        id: TEST_TRIP_DAY_ID,
        tripId: TEST_TRIP_ID,
        dayNumber: 1,
        date: "2026-07-01",
        title: "Zermatt Arrival",
        photosJson: JSON.stringify([
          {
            id: "day_photo_1",
            url: "https://example.com/gornergrat-sunrise.jpg",
            caption: "Gornergrat Sunrise",
          },
        ]),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(trips).where(eq(trips.id, TEST_TRIP_ID));
    await db.delete(tripDays).where(eq(tripDays.tripId, TEST_TRIP_ID));
    await db.delete(gallery).where(eq(gallery.id, TEST_GALLERY_ID));
    await db.delete(attachments).where(eq(attachments.entityId, TEST_TRIP_ID));
    await db.delete(relationships).where(
      or(eq(relationships.sourceId, TEST_TRIP_ID), eq(relationships.targetId, TEST_TRIP_ID))
    );
  });

  it("connects batch photos (gallery and Cloudinary) directly to a trip and removes them", async () => {
    const batchPhotos = [
      {
        type: "gallery" as const,
        id: TEST_GALLERY_ID,
        title: "Matterhorn at Dawn",
      },
      {
        type: "cloudinary" as const,
        url: "https://res.cloudinary.com/test/image/upload/v12345/direct-trip.jpg",
        title: "Glacier Trek",
        publicId: "direct-trip",
        width: 1920,
        height: 1080,
      },
    ];

    const connectRes = await connectTripPhotosBatchAction(TEST_TRIP_ID, batchPhotos, "taken_at");
    expect(connectRes.success).toBe(true);
    expect(connectRes.count).toBe(2);

    const hubData = await getTripHubDataAction(TEST_TRIP_SLUG);
    expect(hubData).not.toBeNull();

    // Verify gallery photo linked
    const galPhoto = hubData?.entities.photos.find((p) => p.id === TEST_GALLERY_ID);
    expect(galPhoto).toBeDefined();
    expect(galPhoto?.title).toBe("Matterhorn at Dawn");
    expect(galPhoto?.sourceType).toBe("direct");

    // Verify Cloudinary attachment photo
    const attPhoto = hubData?.entities.photos.find((p) => p.sourceType === "attachment");
    expect(attPhoto).toBeDefined();
    expect(attPhoto?.title).toBe("Glacier Trek");
    expect(attPhoto?.relationshipId).toBeTruthy();

    // Verify the itinerary day photo rolled up (read-only, no relationshipId)
    const dayPhoto = hubData?.entities.photos.find((p) => p.sourceType === "day");
    expect(dayPhoto).toBeDefined();
    expect(dayPhoto?.title).toBe("Gornergrat Sunrise");
    expect(dayPhoto?.sourceDay?.dayNumber).toBe(1);
    expect(dayPhoto?.relationshipId).toBeUndefined();

    // 2 picker photos + 1 itinerary day photo
    expect(hubData?.entities.photos.length).toBe(3);

    // Remove the Cloudinary attachment
    if (attPhoto?.relationshipId) {
      const removeAttRes = await removeTripPhotoConnectionAction(
        attPhoto.relationshipId,
        TEST_TRIP_ID,
        TEST_TRIP_SLUG
      );
      expect(removeAttRes.success).toBe(true);
    }

    // Remove the gallery photo link
    if (galPhoto) {
      const removeGalRes = await removeTripPhotoConnectionAction(
        galPhoto.id,
        TEST_TRIP_ID,
        TEST_TRIP_SLUG
      );
      expect(removeGalRes.success).toBe(true);
    }

    // Only the read-only itinerary day photo remains after disconnecting picker photos
    const hubDataClean = await getTripHubDataAction(TEST_TRIP_SLUG);
    expect(hubDataClean?.entities.photos.length).toBe(1);
    expect(hubDataClean?.entities.photos[0]?.sourceType).toBe("day");
  });
});
