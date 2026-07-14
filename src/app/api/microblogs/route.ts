import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { microblogs, relatedMicroblogs, locations, trips } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();

    const rawPosts = await db
      .select({
        id: microblogs.id,
        slug: microblogs.slug,
        contentMarkdown: microblogs.contentMarkdown,
        publishedAt: microblogs.publishedAt,
        tags: microblogs.tags,
        coverImageUrl: microblogs.coverImageUrl,
        images: microblogs.images,
        locationId: microblogs.locationId,
        tripId: microblogs.tripId,
      })
      .from(microblogs)
      .where(eq(microblogs.status, "published"))
      .orderBy(desc(microblogs.publishedAt));

    // Pre-fetch locations and trips map for fast resolution
    const [allLocations, allTrips] = await Promise.all([
      db.select().from(locations),
      db.select().from(trips),
    ]);

    const locationMap = new Map(allLocations.map((loc) => [loc.id, loc]));
    const tripMap = new Map(allTrips.map((trip) => [trip.id, trip]));

    // Fetch all related posts mapping
    const relations = await db
      .select({
        microblogId: relatedMicroblogs.microblogId,
        relatedSlug: microblogs.slug,
      })
      .from(relatedMicroblogs)
      .innerJoin(microblogs, eq(relatedMicroblogs.relatedMicroblogId, microblogs.id));

    // Map relations by microblogId
    const relationsMap: Record<string, string[]> = {};
    for (const rel of relations) {
      if (!relationsMap[rel.microblogId]) {
        relationsMap[rel.microblogId] = [];
      }
      relationsMap[rel.microblogId].push(rel.relatedSlug);
    }

    const posts = rawPosts.map((post) => {
      let parsedTags = [];
      try {
        parsedTags = JSON.parse(post.tags);
      } catch (e) {}

      let parsedImages = [];
      try {
        parsedImages = JSON.parse(post.images);
      } catch (e) {}

      const locRecord = post.locationId ? locationMap.get(post.locationId) : null;
      const tripRecord = post.tripId ? tripMap.get(post.tripId) : null;

      return {
        id: post.id,
        slug: post.slug,
        contentMarkdown: post.contentMarkdown,
        publishedAt: post.publishedAt,
        tags: parsedTags,
        coverImageUrl: post.coverImageUrl,
        images: parsedImages,
        relatedPosts: relationsMap[post.id] || [],
        locationId: post.locationId || null,
        tripId: post.tripId || null,
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
      };
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Failed to fetch microblogs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
