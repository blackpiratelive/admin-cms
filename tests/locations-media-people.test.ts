import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, ensureDbInitialized } from "../src/db";
import {
  locations,
  persons,
  trips,
  tripDays,
  gallery,
  attachments,
  relationships,
} from "../src/db/schema";
import { eq, or } from "drizzle-orm";
import {
  getLocationHubDataAction,
  connectLocationToPersonAction,
  removeLocationPersonConnectionAction,
  connectLocationPhotosBatchAction,
  removeLocationPhotoConnectionAction,
  connectLocationToTrip,
  removeLocationTripConnection,
} from "../src/features/locations/actions";

const TEST_LOC_ID = "loc_test_lmp_kyoto";
const TEST_LOC_SLUG = "test-kyoto-lmp";
const TEST_PERSON_ID = "person_test_lmp_kenji";
const TEST_TRIP_ID = "trip_test_lmp_japan";
const TEST_TRIP_SLUG = "test-japan-lmp";
const TEST_GALLERY_DIRECT_ID = "gal_test_lmp_direct";
const TEST_GALLERY_TRIP_ID = "gal_test_lmp_trip";
const TEST_TRIP_DAY_ID = "tripday_test_lmp_day1";

describe("Location Entity: People & Photos Integration and Trip Photo Roll-up", () => {
  beforeAll(async () => {
    await ensureDbInitialized();
    const now = new Date().toISOString();

    // 1. Create test location
    await db
      .insert(locations)
      .values({
        id: TEST_LOC_ID,
        name: "Kyoto Test Sanctuary",
        slug: TEST_LOC_SLUG,
        city: "Kyoto",
        country: "Japan",
        visibility: "public",
        favorite: 1,
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // 2. Create test person
    await db
      .insert(persons)
      .values({
        id: TEST_PERSON_ID,
        displayName: "Kenji Sato",
        name: "Kenji Sato",
        slug: "kenji-sato-lmp",
        relationshipType: "Friend",
        visibility: "public",
        favorite: 0,
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // 3. Create test trip
    await db
      .insert(trips)
      .values({
        id: TEST_TRIP_ID,
        title: "Japan Autumn Voyage",
        slug: TEST_TRIP_SLUG,
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        status: "completed",
        visibility: "public",
        favorite: 1,
        tags: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // 4. Create gallery photos: one standalone, one tagged with trip
    await db
      .insert(gallery)
      .values([
        {
          id: TEST_GALLERY_DIRECT_ID,
          title: "Kinkaku-ji Golden Pavilion",
          slug: "kinkaku-ji-golden-pavilion-lmp",
          originalUrl: "https://example.com/kinkaku.jpg",
          largeUrl: "https://example.com/kinkaku-lg.jpg",
          mediumUrl: "https://example.com/kinkaku-md.jpg",
          thumbnailUrl: "https://example.com/kinkaku-sm.jpg",
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: TEST_GALLERY_TRIP_ID,
          title: "Fushimi Inari Torii Gates",
          slug: "fushimi-inari-torii-gates-lmp",
          originalUrl: "https://example.com/fushimi.jpg",
          largeUrl: "https://example.com/fushimi-lg.jpg",
          mediumUrl: "https://example.com/fushimi-md.jpg",
          thumbnailUrl: "https://example.com/fushimi-sm.jpg",
          tripId: TEST_TRIP_ID, // Directly associated with trip
          visibility: "public",
          createdAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoNothing();

    // 5. Create trip day with photosJson
    await db
      .insert(tripDays)
      .values({
        id: TEST_TRIP_DAY_ID,
        tripId: TEST_TRIP_ID,
        dayNumber: 1,
        date: "2026-10-11",
        title: "Exploring Eastern Kyoto",
        photosJson: JSON.stringify([
          {
            id: "tripday_photo_1",
            url: "https://example.com/bamboo-grove.jpg",
            caption: "Arashiyama Bamboo Grove Walk",
          },
        ]),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    // Clean up all created test entities
    await db.delete(locations).where(eq(locations.id, TEST_LOC_ID));
    await db.delete(persons).where(eq(persons.id, TEST_PERSON_ID));
    await db.delete(trips).where(eq(trips.id, TEST_TRIP_ID));
    await db.delete(tripDays).where(eq(tripDays.tripId, TEST_TRIP_ID));
    await db.delete(gallery).where(
      or(eq(gallery.id, TEST_GALLERY_DIRECT_ID), eq(gallery.id, TEST_GALLERY_TRIP_ID))
    );
    await db.delete(attachments).where(
      or(eq(attachments.entityId, TEST_LOC_ID), eq(attachments.entityId, TEST_TRIP_ID))
    );
    await db.delete(relationships).where(
      or(
        eq(relationships.sourceId, TEST_LOC_ID),
        eq(relationships.targetId, TEST_LOC_ID),
        eq(relationships.sourceId, TEST_TRIP_ID),
        eq(relationships.targetId, TEST_TRIP_ID),
        eq(relationships.sourceId, TEST_PERSON_ID),
        eq(relationships.targetId, TEST_PERSON_ID)
      )
    );
  });

  it("links a person to a location and retrieves them in location hub data", async () => {
    const connectRes = await connectLocationToPersonAction(
      TEST_LOC_ID,
      TEST_PERSON_ID,
      "accompanied"
    );
    expect(connectRes.success).toBe(true);

    const hubData = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(hubData).not.toBeNull();
    expect(hubData?.entities.people.length).toBe(1);

    const linkedPerson = hubData?.entities.people[0];
    expect(linkedPerson?.person.id).toBe(TEST_PERSON_ID);
    expect(linkedPerson?.person.displayName).toBe("Kenji Sato");
    expect(linkedPerson?.relationshipId).toBeTruthy();

    // Disconnect person
    const disconnectRes = await removeLocationPersonConnectionAction(
      linkedPerson!.relationshipId!,
      TEST_LOC_SLUG,
      TEST_PERSON_ID
    );
    expect(disconnectRes.success).toBe(true);

    const hubDataAfter = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(hubDataAfter?.entities.people.length).toBe(0);
  });

  it("connects batch photos (gallery and Cloudinary) directly to a location", async () => {
    const batchPhotos = [
      {
        type: "gallery" as const,
        id: TEST_GALLERY_DIRECT_ID,
        title: "Kinkaku-ji Golden Pavilion",
      },
      {
        type: "cloudinary" as const,
        url: "https://res.cloudinary.com/test/image/upload/v12345/direct-location.jpg",
        title: "Direct Upload Sunset",
        publicId: "direct-location",
        width: 1920,
        height: 1080,
      },
    ];

    const connectRes = await connectLocationPhotosBatchAction(TEST_LOC_ID, batchPhotos, "taken_at");
    expect(connectRes.success).toBe(true);
    expect(connectRes.count).toBe(2);

    const hubData = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(hubData).not.toBeNull();
    expect(hubData?.entities.photos.length).toBe(2);

    // Verify direct gallery photo
    const galPhoto = hubData?.entities.photos.find((p) => p.id === TEST_GALLERY_DIRECT_ID);
    expect(galPhoto).toBeDefined();
    expect(galPhoto?.title).toBe("Kinkaku-ji Golden Pavilion");
    expect(galPhoto?.sourceType).toBe("direct");
    expect(galPhoto?.sourceTrip).toBeUndefined();

    // Verify attachment photo
    const attPhoto = hubData?.entities.photos.find((p) => p.sourceType === "attachment");
    expect(attPhoto).toBeDefined();
    expect(attPhoto?.title).toBe("Direct Upload Sunset");
    expect(attPhoto?.relationshipId).toBeTruthy();

    // Clean up direct photos
    if (attPhoto?.relationshipId) {
      const removeAttRes = await removeLocationPhotoConnectionAction(
        attPhoto.relationshipId,
        TEST_LOC_ID,
        TEST_LOC_SLUG
      );
      expect(removeAttRes.success).toBe(true);
    }

    if (galPhoto) {
      const removeGalRes = await removeLocationPhotoConnectionAction(
        galPhoto.id,
        TEST_LOC_ID,
        TEST_LOC_SLUG
      );
      expect(removeGalRes.success).toBe(true);
    }

    const hubDataClean = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(hubDataClean?.entities.photos.length).toBe(0);
  });

  it("rolls up photos associated with a trip when trip is added to a location, tagging with 'from this trip'", async () => {
    // 1. Initial check: location should have 0 photos
    const initialHub = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(initialHub?.entities.photos.length).toBe(0);

    // 2. Associate trip with location
    const connectTripRes = await connectLocationToTrip(TEST_LOC_ID, TEST_TRIP_ID);
    expect(connectTripRes.success).toBe(true);

    // 3. Query location hub data - should now include trip's gallery photo and trip day photo!
    const tripHub = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(tripHub).not.toBeNull();
    expect(tripHub?.entities.associatedTrips.length).toBe(1);

    const tripPhotos = tripHub?.entities.photos || [];
    expect(tripPhotos.length).toBeGreaterThanOrEqual(2);

    // Verify trip gallery photo rolled up with trip metadata
    const rolledUpGal = tripPhotos.find((p) => p.id === TEST_GALLERY_TRIP_ID);
    expect(rolledUpGal).toBeDefined();
    expect(rolledUpGal?.sourceType).toBe("trip");
    expect(rolledUpGal?.sourceTrip).toEqual({
      id: TEST_TRIP_ID,
      title: "Japan Autumn Voyage",
      slug: TEST_TRIP_SLUG,
    });

    // Verify trip day photo rolled up with trip metadata
    const rolledUpDayPhoto = tripPhotos.find((p) => p.thumbnailUrl?.includes("bamboo-grove.jpg"));
    expect(rolledUpDayPhoto).toBeDefined();
    expect(rolledUpDayPhoto?.sourceType).toBe("trip");
    expect(rolledUpDayPhoto?.sourceTrip).toEqual({
      id: TEST_TRIP_ID,
      title: "Japan Autumn Voyage",
      slug: TEST_TRIP_SLUG,
    });
    expect(rolledUpDayPhoto?.title).toBe("Arashiyama Bamboo Grove Walk");

    // 4. Disconnect trip from location
    const tripRelId = tripHub?.entities.associatedTrips[0]?.relationshipId;
    expect(tripRelId).toBeTruthy();

    const unlinkRes = await removeLocationTripConnection(
      tripRelId!,
      TEST_LOC_SLUG,
      TEST_TRIP_SLUG
    );
    expect(unlinkRes.success).toBe(true);

    // 5. Verify location photos no longer include the unlinked trip's photos
    const hubAfterUnlink = await getLocationHubDataAction(TEST_LOC_SLUG);
    expect(hubAfterUnlink?.entities.associatedTrips.length).toBe(0);
    expect(hubAfterUnlink?.entities.photos.length).toBe(0);
  });
});
