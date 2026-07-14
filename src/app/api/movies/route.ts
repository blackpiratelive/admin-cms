import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { traktMovies, movieMetadata, locations, trips } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();

    const moviesList = await db.select().from(traktMovies).orderBy(desc(traktMovies.watchedAt));
    const metadataList = await db.select().from(movieMetadata);
    const [allLocations, allTrips] = await Promise.all([
      db.select().from(locations),
      db.select().from(trips),
    ]);

    const metadataMap = new Map(metadataList.map((m) => [m.traktId, m]));
    const locationMap = new Map(allLocations.map((loc) => [loc.id, loc]));
    const tripMap = new Map(allTrips.map((trip) => [trip.id, trip]));

    const movies = moviesList
      .map((movie) => {
        const meta = metadataMap.get(movie.traktId);
        const visibility = meta?.visibility || movie.visibility || "public";

        if (visibility === "private") {
          return null;
        }

        let tags: string[] = [];
        let watchedWith: string[] = [];
        try {
          if (meta?.tags) tags = JSON.parse(meta.tags);
        } catch {}
        try {
          if (meta?.watchedWith) watchedWith = JSON.parse(meta.watchedWith);
        } catch {}

        const locRecord = meta?.locationId ? locationMap.get(meta.locationId) : null;
        const tripRecord = meta?.tripId ? tripMap.get(meta.tripId) : null;

        return {
          traktId: movie.traktId,
          tmdbId: movie.tmdbId,
          title: movie.title,
          year: movie.year,
          overview: movie.overview,
          runtime: movie.runtime,
          rating: movie.rating,
          posterPath: movie.posterPath,
          backdropPath: movie.backdropPath,
          watchedAt: movie.watchedAt,
          favorite: meta?.favorite === 1 || movie.favorite === 1,
          personalRating: meta?.personalRating ?? movie.rating ?? null,
          review: meta?.review || movie.review || null,
          notes: meta?.notes || movie.notes || null,
          watchLocation: meta?.watchLocation || null,
          watchedWith,
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

    return NextResponse.json({ movies });
  } catch (error: any) {
    console.error("Failed to fetch public movies for API:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
