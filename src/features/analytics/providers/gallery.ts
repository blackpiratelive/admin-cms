import { db, ensureDbInitialized } from "@/db";
import { gallery, locations, trips, persons } from "@/db/schema";
import { AnalyticsProvider, GalleryAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

import { getTimeFilterStartEnd } from "../config";

export const galleryAnalyticsProvider: AnalyticsProvider = {
  name: "gallery",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<GalleryAnalyticsData> => {
    await ensureDbInitialized();

    const [allPhotos, allLocs, allTripsList, allPeople] = await Promise.all([
      db.select().from(gallery),
      db.select().from(locations),
      db.select().from(trips),
      db.select().from(persons),
    ]);

    const locMap = new Map(allLocs.map((l) => [l.id, l.name]));
    const tripMap = new Map(allTripsList.map((t) => [t.id, t.title]));
    const personMap = new Map(allPeople.map((p) => [p.id, p.displayName || p.name]));

    let filtered = allPhotos;
    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);
    if (start || end) {
      filtered = allPhotos.filter((p) => {
        const d = new Date(p.takenAt || p.createdAt);
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const totalPhotos = filtered.length;
    let storageUsedBytes = 0;
    let favoritePhotosCount = 0;
    let photosThisMonth = 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const locCounts: Record<string, number> = {};
    const tripCounts: Record<string, number> = {};
    const personCounts: Record<string, number> = {};

    filtered.forEach((p) => {
      const size = p.fileSize || 0;
      storageUsedBytes += size;

      if (p.featured) favoritePhotosCount += 1;

      const pTime = new Date(p.createdAt).getTime();
      if (!isNaN(pTime) && pTime >= monthStart) photosThisMonth += 1;

      if (p.locationId) {
        locCounts[p.locationId] = (locCounts[p.locationId] || 0) + 1;
      }
      if (p.tripId) {
        tripCounts[p.tripId] = (tripCounts[p.tripId] || 0) + 1;
      }
    });

    const photosByLocation = Object.entries(locCounts).map(([locationId, count]) => ({
      locationId,
      name: locMap.get(locationId) || locationId,
      count,
    })).sort((a, b) => b.count - a.count);

    const photosByTrip = Object.entries(tripCounts).map(([tripId, count]) => ({
      tripId,
      name: tripMap.get(tripId) || tripId,
      count,
    })).sort((a, b) => b.count - a.count);

    const photosByPerson = Object.entries(personCounts).map(([personId, count]) => ({
      personId,
      name: personMap.get(personId) || personId,
      count,
    })).sort((a, b) => b.count - a.count);

    const mostPhotographedLocation = photosByLocation[0]
      ? { id: photosByLocation[0].locationId, name: photosByLocation[0].name, count: photosByLocation[0].count }
      : null;

    const mostPhotographedPerson = photosByPerson[0]
      ? { id: photosByPerson[0].personId, name: photosByPerson[0].name, count: photosByPerson[0].count }
      : null;

    return {
      totalPhotos,
      photosThisMonth,
      storageUsedBytes,
      averageFileSizeBytes: totalPhotos > 0 ? Math.round(storageUsedBytes / totalPhotos) : 0,
      photosByLocation,
      photosByPerson,
      photosByTrip,
      mostPhotographedPerson,
      mostPhotographedLocation,
      favoritePhotosCount,
    };
  },
};
