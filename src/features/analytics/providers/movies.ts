import { db, ensureDbInitialized } from "@/db";
import { traktMovies, movieMetadata } from "@/db/schema";
import { AnalyticsProvider, MovieAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

export const movieAnalyticsProvider: AnalyticsProvider = {
  name: "movies",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<MovieAnalyticsData> => {
    await ensureDbInitialized();

    const [allMovies, allMeta] = await Promise.all([
      db.select().from(traktMovies),
      db.select().from(movieMetadata),
    ]);

    const metaMap = new Map(allMeta.map((m) => [m.traktId, m]));

    let filtered = allMovies;
    if (timeFilter && timeFilter !== "lifetime") {
      const now = new Date();
      let start: Date | null = null;
      let end: Date | null = null;

      if (timeFilter === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (timeFilter === "this_week") {
        const day = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      } else if (timeFilter === "this_month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (timeFilter === "this_year") {
        start = new Date(now.getFullYear(), 0, 1);
      } else if (timeFilter === "custom" && customRange) {
        if (customRange.startDate) start = new Date(customRange.startDate);
        if (customRange.endDate) end = new Date(customRange.endDate);
      }

      filtered = allMovies.filter((m) => {
        const d = new Date(m.watchedAt || m.createdAt);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const moviesWatched = filtered.length;
    let totalRating = 0;
    let ratedCount = 0;
    let totalRuntimeMinutes = 0;

    const genreCounts: Record<string, number> = {};
    const yearCounts: Record<number, number> = {};
    const monthCounts: Record<string, number> = {};
    const watchCalendarMap: Record<string, number> = {};

    filtered.forEach((m) => {
      totalRuntimeMinutes += m.runtime || 0;

      const meta = metaMap.get(m.traktId);
      const rating = meta?.personalRating ?? m.rating;
      if (rating && rating > 0) {
        totalRating += rating;
        ratedCount += 1;
      }

      if (m.year) {
        yearCounts[m.year] = (yearCounts[m.year] || 0) + 1;
      }

      try {
        const genres: string[] = JSON.parse(m.genres || "[]");
        genres.forEach((g) => (genreCounts[g] = (genreCounts[g] || 0) + 1));
      } catch (err) {}

      if (m.watchedAt) {
        const dateObj = new Date(m.watchedAt);
        if (!isNaN(dateObj.getTime())) {
          const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
          monthCounts[ym] = (monthCounts[ym] || 0) + 1;

          const dateStr = dateObj.toISOString().split("T")[0];
          watchCalendarMap[dateStr] = (watchCalendarMap[dateStr] || 0) + 1;
        }
      }
    });

    const averageRating = ratedCount > 0 ? Number((totalRating / ratedCount).toFixed(1)) : 0;

    return {
      moviesWatched,
      averageRating,
      totalRuntimeMinutes,
      moviesByGenre: Object.entries(genreCounts)
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count),
      moviesByYear: Object.entries(yearCounts)
        .map(([yearStr, count]) => ({ year: parseInt(yearStr, 10), count }))
        .sort((a, b) => b.year - a.year),
      moviesByLanguage: [],
      moviesByCountry: [],
      watchCalendar: Object.entries(watchCalendarMap).map(([date, count]) => ({ date, count })),
      monthlyTrend: Object.entries(monthCounts).map(([month, count]) => ({ month, count })),
    };
  },
};
