import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { traktShows, tvShowMetadata, locations, trips } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();

    const showsList = await db.select().from(traktShows).orderBy(desc(traktShows.updatedAt));
    const metadataList = await db.select().from(tvShowMetadata);
    const [allLocations, allTrips] = await Promise.all([
      db.select().from(locations),
      db.select().from(trips),
    ]);

    const metadataMap = new Map(metadataList.map((m) => [m.traktId, m]));
    const locationMap = new Map(allLocations.map((loc) => [loc.id, loc]));
    const tripMap = new Map(allTrips.map((trip) => [trip.id, trip]));

    const shows = showsList
      .map((show) => {
        const meta = metadataMap.get(show.traktId);
        const visibility = meta?.visibility || show.visibility || "public";

        if (visibility === "private") {
          return null;
        }

        let tags: string[] = [];
        try {
          if (meta?.tags) tags = JSON.parse(meta.tags);
        } catch {}

        const locRecord = meta?.locationId ? locationMap.get(meta.locationId) : null;
        const tripRecord = meta?.tripId ? tripMap.get(meta.tripId) : null;

        return {
          traktId: show.traktId,
          tmdbId: show.tmdbId,
          title: show.title,
          year: show.year,
          overview: show.overview,
          status: show.status,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          favorite: meta?.favorite === 1 || show.favorite === 1,
          personalRating: meta?.personalRating ?? null,
          review: meta?.review || show.review || null,
          notes: meta?.notes || show.notes || null,
          tags,
          locationId: meta?.locationId || null,
          tripId: meta?.tripId || null,
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
      })
      .filter(Boolean);

    return NextResponse.json({ shows });
  } catch (error: any) {
    console.error("Failed to fetch public shows for API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
