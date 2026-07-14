import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { gallery, locations, trips } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();

    const rawPhotos = await db
      .select()
      .from(gallery)
      .where(eq(gallery.visibility, "public"))
      .orderBy(desc(gallery.createdAt));

    const [allLocations, allTrips] = await Promise.all([
      db.select().from(locations),
      db.select().from(trips),
    ]);

    const locationMap = new Map(allLocations.map((loc) => [loc.id, loc]));
    const tripMap = new Map(allTrips.map((trip) => [trip.id, trip]));

    const photos = rawPhotos.map((photo) => {
      let parsedTags: string[] = [];
      try {
        if (photo.tags) {
          parsedTags = JSON.parse(photo.tags);
        }
      } catch (e) {
        if (typeof photo.tags === "string") {
          parsedTags = photo.tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }

      const locRecord = photo.locationId ? locationMap.get(photo.locationId) : null;
      const tripRecord = photo.tripId ? tripMap.get(photo.tripId) : null;

      return {
        id: photo.id,
        title: photo.title,
        slug: photo.slug,
        description: photo.description,
        originalUrl: photo.originalUrl,
        largeUrl: photo.largeUrl,
        mediumUrl: photo.mediumUrl,
        thumbnailUrl: photo.thumbnailUrl,
        width: photo.width,
        height: photo.height,
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        camera: photo.camera,
        lens: photo.lens,
        focalLength: photo.focalLength,
        aperture: photo.aperture,
        shutterSpeed: photo.shutterSpeed,
        iso: photo.iso,
        takenAt: photo.takenAt,
        latitude: photo.latitude,
        longitude: photo.longitude,
        locationName: photo.locationName,
        locationId: photo.locationId || null,
        tripId: photo.tripId || null,
        location: locRecord
          ? {
              id: locRecord.id,
              name: locRecord.name,
              city: locRecord.city,
              country: locRecord.country,
              latitude: locRecord.latitude,
              longitude: locRecord.longitude,
            }
          : null,
        trip: tripRecord
          ? {
              id: tripRecord.id,
              title: tripRecord.title,
              slug: tripRecord.slug,
              status: tripRecord.status,
            }
          : null,
        visibility: photo.visibility,
        featured: photo.featured === 1,
        tags: parsedTags,
        album: photo.album,
        createdAt: photo.createdAt,
        updatedAt: photo.updatedAt,
      };
    });

    return NextResponse.json({ photos });
  } catch (error: any) {
    console.error("Failed to fetch gallery photos for API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
