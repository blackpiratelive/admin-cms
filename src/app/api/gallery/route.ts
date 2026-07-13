import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { gallery } from "@/db/schema";
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

    const photos = rawPhotos.map((photo) => {
      let parsedTags: string[] = [];
      try {
        if (photo.tags) {
          parsedTags = JSON.parse(photo.tags);
        }
      } catch (e) {
        // Fallback if tags was saved as raw string
        if (typeof photo.tags === "string") {
          parsedTags = photo.tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      }

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
