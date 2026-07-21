import { db, ensureDbInitialized } from "@/db";
import { microblogs } from "@/db/schema";
import { AnalyticsProvider, MicroblogAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";

import { getTimeFilterStartEnd } from "../config";

export const microblogAnalyticsProvider: AnalyticsProvider = {
  name: "microblog",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<MicroblogAnalyticsData> => {
    await ensureDbInitialized();

    const allPosts = await db.select().from(microblogs);

    let filtered = allPosts;
    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);
    if (start || end) {
      filtered = allPosts.filter((p) => {
        const d = new Date(p.createdAt);
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const totalPosts = filtered.length;
    let draftsCount = 0;
    let publishedCount = 0;
    let totalChars = 0;
    let imagePostsCount = 0;

    const monthCounts: Record<string, number> = {};
    const weekdayCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};
    const tagCounts: Record<string, number> = {};

    filtered.forEach((p) => {
      if (p.status === "draft") draftsCount += 1;
      if (p.status === "published") publishedCount += 1;

      const len = (p.contentMarkdown || "").length;
      totalChars += len;

      try {
        const imgs = JSON.parse(p.images || "[]");
        if (imgs.length > 0 || p.coverImageUrl) imagePostsCount += 1;
      } catch (err) {}

      const dateObj = new Date(p.createdAt);
      if (!isNaN(dateObj.getTime())) {
        const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        weekdayCounts[dayNames[dateObj.getDay()]] = (weekdayCounts[dayNames[dateObj.getDay()]] || 0) + 1;

        const hour = dateObj.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }

      try {
        const tags: string[] = JSON.parse(p.tags || "[]");
        tags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1));
      } catch (err) {}
    });

    const averageLengthChars = totalPosts > 0 ? Math.round(totalChars / totalPosts) : 0;

    return {
      totalPosts,
      draftsCount,
      publishedCount,
      averageLengthChars,
      postingFrequencyPerWeek: Number((totalPosts / 4).toFixed(1)),
      postsByMonth: Object.entries(monthCounts).map(([month, count]) => ({ month, count })),
      postsByWeekday: Object.entries(weekdayCounts).map(([day, count]) => ({ day, count })),
      postsByHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourCounts[h] || 0 })),
      imagePostsCount,
      blueskySyncCount: 0,
      mastodonSyncCount: 0,
      mostUsedTags: Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  },
};
