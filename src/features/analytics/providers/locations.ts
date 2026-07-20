import { db, ensureDbInitialized } from "@/db";
import { locations, journalEntries, gallery, trips } from "@/db/schema";
import { AnalyticsProvider, LocationAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

export const locationAnalyticsProvider: AnalyticsProvider = {
  name: "locations",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<LocationAnalyticsData> => {
    await ensureDbInitialized();

    const [allLocs, allEntries, allPhotos, allTripsList] = await Promise.all([
      db.select().from(locations),
      db.select().from(journalEntries),
      db.select().from(gallery),
      db.select().from(trips),
    ]);

    const countriesSet = new Set<string>();
    const statesSet = new Set<string>();
    const citiesSet = new Set<string>();

    let totalVisitCount = 0;
    const locVisitMap: Array<{ id: string; name: string; visitCount: number }> = [];

    allLocs.forEach((l) => {
      if (l.country) countriesSet.add(l.country.trim().toLowerCase());
      if (l.state) statesSet.add(l.state.trim().toLowerCase());
      if (l.city) citiesSet.add(l.city.trim().toLowerCase());

      const vc = l.visitCount || 1;
      totalVisitCount += vc;
      locVisitMap.push({ id: l.id, name: l.name, visitCount: vc });
    });

    locVisitMap.sort((a, b) => b.visitCount - a.visitCount);

    const journalEntriesCount = allEntries.filter((e) => !!e.locationId).length;
    const photosCount = allPhotos.filter((p) => !!p.locationId).length;

    return {
      countriesCount: countriesSet.size,
      statesCount: statesSet.size,
      citiesCount: citiesSet.size,
      placesCount: allLocs.length,
      journalEntriesCount,
      photosCount,
      tripsCount: allTripsList.length,
      peopleCount: 0,
      totalVisitCount,
      mostVisitedLocations: locVisitMap.slice(0, 10),
    };
  },
};
