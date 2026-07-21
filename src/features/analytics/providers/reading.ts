import { AnalyticsProvider, CustomDateRange, ReadingAnalyticsData, TimeFilterRange } from "../types";
import { db, ensureDbInitialized } from "@/db";
import { rssArticles, rssFeeds } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { getTimeFilterStartEnd } from "../config";

export const readingAnalyticsProvider: AnalyticsProvider = {
  name: "reading",

  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<ReadingAnalyticsData> => {
    await ensureDbInitialized();

    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);

    const allArticles = await db.select().from(rssArticles);
    const allFeeds = await db.select().from(rssFeeds);

    let filtered = allArticles;
    if (start || end) {
      filtered = allArticles.filter((art) => {
        const dStr = art.readDate || art.publicationDate || art.createdAt;
        if (!dStr) return false;
        const d = new Date(dStr);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const readArticles = filtered.filter((a) => a.isRead === 1);
    const starredArticles = filtered.filter((a) => a.isStarred === 1);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let readToday = 0;
    let readThisWeek = 0;
    let readThisMonth = 0;
    let readThisYear = 0;

    const calendarMap = new Map<string, { count: number; wordCount: number; seconds: number }>();
    const feedCountMap = new Map<string, number>();
    const categoryCountMap = new Map<string, number>();
    const starredFeedMap = new Map<string, number>();
    const starredCategoryMap = new Map<string, number>();
    const hourMap = new Map<number, number>();
    const weekdayMap = new Map<string, number>();
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let totalEstReadingTime = 0;

    for (const art of readArticles) {
      const dateStr = (art.readDate || art.publicationDate || art.createdAt).slice(0, 10);
      const d = new Date(art.readDate || art.publicationDate || art.createdAt);

      if (dateStr === todayStr) readToday++;
      if (d >= startOfWeek) readThisWeek++;
      if (d >= startOfMonth) readThisMonth++;
      if (d >= startOfYear) readThisYear++;

      totalEstReadingTime += art.readingTime || Math.max(30, Math.ceil((art.wordCount || 100) / 200 * 60));

      const calEntry = calendarMap.get(dateStr) || { count: 0, wordCount: 0, seconds: 0 };
      calEntry.count++;
      calEntry.wordCount += art.wordCount || 0;
      calEntry.seconds += art.readingTime || 60;
      calendarMap.set(dateStr, calEntry);

      const fName = art.feedName || "Unknown Feed";
      feedCountMap.set(fName, (feedCountMap.get(fName) || 0) + 1);

      const catName = art.category || "General";
      categoryCountMap.set(catName, (categoryCountMap.get(catName) || 0) + 1);

      const h = d.getHours();
      hourMap.set(h, (hourMap.get(h) || 0) + 1);

      const w = weekdays[d.getDay()];
      weekdayMap.set(w, (weekdayMap.get(w) || 0) + 1);
    }

    for (const art of starredArticles) {
      const fName = art.feedName || "Unknown Feed";
      starredFeedMap.set(fName, (starredFeedMap.get(fName) || 0) + 1);

      const catName = art.category || "General";
      starredCategoryMap.set(catName, (starredCategoryMap.get(catName) || 0) + 1);
    }

    // Streaks
    const sortedDates = Array.from(calendarMap.keys()).sort();
    let currentStreak = 0;
    let longestStreak = 0;

    if (sortedDates.length > 0) {
      let tempStreak = 1;
      longestStreak = 1;

      const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let dStr = checkDate.toISOString().slice(0, 10);

      if (calendarMap.has(dStr)) {
        currentStreak = 1;
      } else {
        checkDate.setDate(checkDate.getDate() - 1);
        dStr = checkDate.toISOString().slice(0, 10);
        if (calendarMap.has(dStr)) currentStreak = 1;
      }

      if (currentStreak > 0) {
        let cur = new Date(dStr);
        while (true) {
          cur.setDate(cur.getDate() - 1);
          const prevStr = cur.toISOString().slice(0, 10);
          if (calendarMap.has(prevStr)) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
    }

    // Top feeds
    const favoriteSources = Array.from(feedCountMap.entries())
      .map(([name, count]) => ({ feedId: name, name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topCategories = Array.from(categoryCountMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Most active day / hour / weekday
    let mostActiveDayStr = sortedDates.length > 0 ? sortedDates[0] : todayStr;
    let maxDayCount = 0;
    for (const [dStr, data] of calendarMap.entries()) {
      if (data.count > maxDayCount) {
        maxDayCount = data.count;
        mostActiveDayStr = dStr;
      }
    }

    let mostActiveHourInt = 9;
    let maxHourCount = 0;
    for (const [h, cnt] of hourMap.entries()) {
      if (cnt > maxHourCount) {
        maxHourCount = cnt;
        mostActiveHourInt = h;
      }
    }

    let mostActiveWkdayStr = "Mon";
    let maxWkdayCount = 0;
    for (const [w, cnt] of weekdayMap.entries()) {
      if (cnt > maxWkdayCount) {
        maxWkdayCount = cnt;
        mostActiveWkdayStr = w;
      }
    }

    const mostReadFeed = favoriteSources.length > 0 ? favoriteSources[0] : null;
    const mostReadCategory = topCategories.length > 0 ? topCategories[0] : null;

    const topStarredFeeds = Array.from(starredFeedMap.entries())
      .map(([name, count]) => ({ feedId: name, name, count }))
      .sort((a, b) => b.count - a.count);
    const mostStarredFeed = topStarredFeeds.length > 0 ? topStarredFeeds[0] : null;

    const topStarredCats = Array.from(starredCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    const mostStarredCategory = topStarredCats.length > 0 ? topStarredCats[0] : null;

    // Reading Heatmap
    const readingHeatmap: Array<{ day: string; hour: number; count: number }> = [];
    for (const day of weekdays) {
      for (let hour = 0; hour < 24; hour++) {
        readingHeatmap.push({ day, hour, count: 0 });
      }
    }

    for (const art of readArticles) {
      const d = new Date(art.readDate || art.publicationDate || art.createdAt);
      const day = weekdays[d.getDay()];
      const hour = d.getHours();
      const match = readingHeatmap.find((h) => h.day === day && h.hour === hour);
      if (match) match.count++;
    }

    // Reading Sessions (grouping articles read within 30 min window)
    const sortedReadArts = [...readArticles].sort((a, b) => {
      const dA = new Date(a.readDate || a.publicationDate || a.createdAt).getTime();
      const dB = new Date(b.readDate || b.publicationDate || b.createdAt).getTime();
      return dA - dB;
    });

    const readingSessions: Array<{ startDate: string; endDate: string; durationMinutes: number; articlesCount: number; wordCount: number }> = [];
    if (sortedReadArts.length > 0) {
      let sStart = sortedReadArts[0].readDate || sortedReadArts[0].publicationDate || sortedReadArts[0].createdAt;
      let sEnd = sStart;
      let sCount = 1;
      let sWords = sortedReadArts[0].wordCount || 0;

      for (let i = 1; i < sortedReadArts.length; i++) {
        const prevTime = new Date(sEnd).getTime();
        const currTime = new Date(sortedReadArts[i].readDate || sortedReadArts[i].publicationDate || sortedReadArts[i].createdAt).getTime();
        const gapMin = (currTime - prevTime) / (1000 * 60);

        if (gapMin <= 30) {
          sEnd = sortedReadArts[i].readDate || sortedReadArts[i].publicationDate || sortedReadArts[i].createdAt;
          sCount++;
          sWords += sortedReadArts[i].wordCount || 0;
        } else {
          const durMin = Math.max(1, Math.round((new Date(sEnd).getTime() - new Date(sStart).getTime()) / (1000 * 60)));
          readingSessions.push({
            startDate: sStart,
            endDate: sEnd,
            durationMinutes: durMin,
            articlesCount: sCount,
            wordCount: sWords,
          });
          sStart = sortedReadArts[i].readDate || sortedReadArts[i].publicationDate || sortedReadArts[i].createdAt;
          sEnd = sStart;
          sCount = 1;
          sWords = sortedReadArts[i].wordCount || 0;
        }
      }
      const durMin = Math.max(1, Math.round((new Date(sEnd).getTime() - new Date(sStart).getTime()) / (1000 * 60)));
      readingSessions.push({
        startDate: sStart,
        endDate: sEnd,
        durationMinutes: durMin,
        articlesCount: sCount,
        wordCount: sWords,
      });
    }

    const unreadCount = allFeeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
    const avgArticlesPerDay = sortedDates.length > 0 ? Number((readArticles.length / Math.max(1, sortedDates.length)).toFixed(1)) : 0;
    const avgReadingTimeSec = readArticles.length > 0 ? Math.round(totalEstReadingTime / readArticles.length) : 0;

    const readingCalendar = Array.from(calendarMap.entries()).map(([date, val]) => ({
      date,
      count: val.count,
      estimatedMinutes: Math.round(val.seconds / 60),
    }));

    const recentReads = [...readArticles]
      .sort((a, b) => new Date(b.readDate || b.publicationDate || b.createdAt).getTime() - new Date(a.readDate || a.publicationDate || a.createdAt).getTime())
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        title: a.title,
        feedName: a.feedName || "RSS Feed",
        category: a.category || "General",
        readDate: a.readDate || a.publicationDate || a.createdAt,
        originalUrl: a.originalUrl,
        isStarred: a.isStarred === 1,
      }));

    const recentStarred = [...starredArticles]
      .sort((a, b) => new Date(b.starredAt || b.publicationDate || b.createdAt).getTime() - new Date(a.starredAt || a.publicationDate || a.createdAt).getTime())
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        title: a.title,
        feedName: a.feedName || "RSS Feed",
        category: a.category || "General",
        starredAt: a.starredAt || a.publicationDate || a.createdAt,
        originalUrl: a.originalUrl,
      }));

    return {
      totalRead: readArticles.length,
      readToday,
      readThisWeek,
      readThisMonth,
      readThisYear,
      lifetimeReads: readArticles.length,
      streakDays: currentStreak,
      longestStreakDays: longestStreak,
      averageArticlesPerDay: avgArticlesPerDay,
      averageReadingTimeSeconds: avgReadingTimeSec,
      totalEstimatedReadingTimeSeconds: totalEstReadingTime,
      mostActiveReadingDay: mostActiveDayStr,
      mostActiveReadingHour: mostActiveHourInt,
      mostActiveWeekday: mostActiveWkdayStr,
      mostReadFeed,
      mostReadCategory,
      mostStarredFeed,
      mostStarredCategory,
      totalStarred: starredArticles.length,
      favoriteSources,
      unreadCount,
      readingCalendar,
      readingHeatmap,
      readingSessions,
      topCategories,
      recentReads,
      recentStarred,
    };
  },
};
