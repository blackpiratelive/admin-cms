import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { microblogs, relatedMicroblogs, locations, trips } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { saveMicroblog, getMicroblogs } from "@/features/microblog/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");

    // If paginated query parameters are passed by the admin app, use getMicroblogs action
    if (page || search || status) {
      const result = await getMicroblogs({
        search: search || "",
        status: status || "all",
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
      });
      return NextResponse.json(result);
    }

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

    const [allLocations, allTrips] = await Promise.all([
      db.select().from(locations),
      db.select().from(trips),
    ]);

    const locationMap = new Map(allLocations.map((loc) => [loc.id, loc]));
    const tripMap = new Map(allTrips.map((trip) => [trip.id, trip]));

    const relations = await db
      .select({
        microblogId: relatedMicroblogs.microblogId,
        relatedSlug: microblogs.slug,
      })
      .from(relatedMicroblogs)
      .innerJoin(microblogs, eq(relatedMicroblogs.relatedMicroblogId, microblogs.id));

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
  } catch (error: any) {
    console.error("Failed to fetch microblogs:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await saveMicroblog(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("Failed to save microblog:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save microblog" },
      { status: 400 }
    );
  }
}
