import { db, ensureDbInitialized } from "@/db";
import { trips, journalEntries, gallery, locations } from "@/db/schema";
import { AnalyticsProvider, TripAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

export const tripAnalyticsProvider: AnalyticsProvider = {
  name: "trips",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<TripAnalyticsData> => {
    await ensureDbInitialized();

    const [allTripsList, allEntries, allPhotos, allLocs] = await Promise.all([
      db.select().from(trips),
      db.select().from(journalEntries),
      db.select().from(gallery),
      db.select().from(locations),
    ]);

    const totalTrips = allTripsList.length;
    let totalTravelDays = 0;
    let longestTrip: { id: string; title: string; days: number } | null = null;
    let shortestTrip: { id: string; title: string; days: number } | null = null;

    allTripsList.forEach((t) => {
      let days = 1;
      if (t.startDate && t.endDate) {
        const start = new Date(t.startDate).getTime();
        const end = new Date(t.endDate).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        }
      }
      totalTravelDays += days;

      if (!longestTrip || days > longestTrip.days) {
        longestTrip = { id: t.id, title: t.title, days };
      }
      if (!shortestTrip || days < shortestTrip.days) {
        shortestTrip = { id: t.id, title: t.title, days };
      }
    });

    const journalEntriesCount = allEntries.filter((e) => !!e.tripId).length;
    const photosCount = allPhotos.filter((p) => !!p.tripId).length;

    const countriesVisitedSet = new Set<string>();
    const citiesVisitedSet = new Set<string>();

    allLocs.forEach((l) => {
      if (l.country) countriesVisitedSet.add(l.country.trim().toLowerCase());
      if (l.city) citiesVisitedSet.add(l.city.trim().toLowerCase());
    });

    return {
      totalTrips,
      totalTravelDays,
      countriesVisitedCount: countriesVisitedSet.size,
      citiesVisitedCount: citiesVisitedSet.size,
      photosCount,
      journalEntriesCount,
      peopleConnectedCount: 0,
      locationsConnectedCount: allLocs.length,
      averageDurationDays: totalTrips > 0 ? Math.round(totalTravelDays / totalTrips) : 0,
      longestTrip,
      shortestTrip,
    };
  },
};
