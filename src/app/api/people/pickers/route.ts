import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import {
  locations,
  trips,
  projects,
  microblogs,
  gallery,
  collections,
} from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();

    const [locs, trps, prjs, mblogs, photos, cols] = await Promise.all([
      db
        .select({ id: locations.id, name: locations.name, city: locations.city, country: locations.country })
        .from(locations)
        .orderBy(locations.name),
      db
        .select({ id: trips.id, title: trips.title, startDate: trips.startDate })
        .from(trips)
        .orderBy(desc(trips.startDate)),
      db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .orderBy(projects.name),
      db
        .select({ id: microblogs.id, slug: microblogs.slug, contentMarkdown: microblogs.contentMarkdown })
        .from(microblogs)
        .orderBy(desc(microblogs.publishedAt))
        .limit(50),
      db
        .select({
          id: gallery.id,
          title: gallery.title,
          thumbnailUrl: gallery.thumbnailUrl,
          mediumUrl: gallery.mediumUrl,
        })
        .from(gallery)
        .orderBy(desc(gallery.createdAt))
        .limit(50),
      db
        .select({ id: collections.id, name: collections.name, description: collections.description })
        .from(collections)
        .orderBy(collections.name),
    ]);

    return NextResponse.json({
      locations: locs,
      trips: trps,
      projects: prjs,
      microblogs: mblogs,
      photos: photos,
      collections: cols,
    });
  } catch (error: any) {
    console.error("Failed to fetch people pickers data:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
