import { db, ensureDbInitialized } from "@/db";
import { traktShows, traktEpisodes, tvShowMetadata } from "@/db/schema";
import { AnalyticsProvider, TvAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

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

      filteredEpisodes = allEpisodes.filter((ep) => {
        const d = new Date(ep.watchedAt || ep.createdAt);
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
