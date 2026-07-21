import { db, ensureDbInitialized } from "@/db";
import { traktShows, traktEpisodes, tvShowMetadata } from "@/db/schema";
import { AnalyticsProvider, TvAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";
import { getTimeFilterStartEnd } from "../config";

export const tvAnalyticsProvider: AnalyticsProvider = {
  name: "tv",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<TvAnalyticsData> => {
    await ensureDbInitialized();

    const [allShows, allEpisodes, allMeta] = await Promise.all([
      db.select().from(traktShows),
      db.select().from(traktEpisodes),
      db.select().from(tvShowMetadata),
    ]);

    const metaMap = new Map(allMeta.map((m) => [m.traktId, m]));

    let filteredShows = allShows;
    let filteredEpisodes = allEpisodes;

    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);
    if (start || end) {
      filteredEpisodes = allEpisodes.filter((ep) => {
        const d = new Date(ep.watchedAt || ep.createdAt);
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });

      filteredShows = allShows.filter((s) => {
        const d = new Date(s.updatedAt || s.createdAt);
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    let showsWatching = 0;
    let showsCompleted = 0;
    let totalRating = 0;
    let ratedCount = 0;

    const monthCounts: Record<string, number> = {};

    filteredShows.forEach((s) => {
      if (s.status === "ended" || s.status === "completed") {
        showsCompleted += 1;
      } else {
        showsWatching += 1;
      }

      const meta = metaMap.get(s.traktId);
      if (meta?.personalRating) {
        totalRating += meta.personalRating;
        ratedCount += 1;
      }
    });

    filteredEpisodes.forEach((ep) => {
      if (ep.watchedAt) {
        const dateObj = new Date(ep.watchedAt);
        if (!isNaN(dateObj.getTime())) {
          const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
          monthCounts[ym] = (monthCounts[ym] || 0) + 1;
        }
      }
    });

    const episodesWatched = filteredEpisodes.length;
    const totalRuntimeMinutes = episodesWatched * 45; // average episode runtime estimation
    const averageRating = ratedCount > 0 ? Number((totalRating / ratedCount).toFixed(1)) : 0;

    return {
      showsWatching,
      showsCompleted,
      episodesWatched,
      totalRuntimeMinutes,
      genres: [],
      platforms: [],
      averageRating,
      monthlyTrend: Object.entries(monthCounts).map(([month, count]) => ({ month, count })),
    };
  },
};
