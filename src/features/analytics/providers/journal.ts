import { db, ensureDbInitialized } from "@/db";
import { journalEntries, journalAssets, journalEntryAssets, persons, locations, trips } from "@/db/schema";
import { AnalyticsProvider, JournalAnalyticsData, TimeFilterRange, CustomDateRange } from "../types";
import { count, eq, sql, gte, lte, and } from "drizzle-orm";

import { getTimeFilterStartEnd } from "../config";

export const journalAnalyticsProvider: AnalyticsProvider = {
  name: "journal",
  computeAnalytics: async (
    timeFilter?: TimeFilterRange,
    customRange?: CustomDateRange
  ): Promise<JournalAnalyticsData> => {
    await ensureDbInitialized();

    const allEntries = await db.select().from(journalEntries);

    // Apply time filter if provided
    let filtered = allEntries;
    const { start, end } = getTimeFilterStartEnd(timeFilter, customRange);
    if (start || end) {
      filtered = allEntries.filter((e) => {
        const d = new Date(e.entryDate || e.createdAt);
        if (isNaN(d.getTime())) return true;
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
    }

    const totalEntries = filtered.length;
    let wordsWritten = 0;
    let charactersWritten = 0;
    let longestEntry: { id: string; title: string; wordCount: number } | null = null;
    let shortestEntry: { id: string; title: string; wordCount: number } | null = null;

    const moodCounts: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};
    const weekdayCounts: Record<string, number> = {};
    const hourCounts: Record<number, number> = {};
    const tagCounts: Record<string, number> = {};
    const calendarMap: Record<string, { count: number; wordCount: number }> = {};

    filtered.forEach((e) => {
      const wc = e.wordCount || 0;
      wordsWritten += wc;
      charactersWritten += wc * 5;

      if (!longestEntry || wc > longestEntry.wordCount) {
        longestEntry = { id: e.id, title: e.slug, wordCount: wc };
      }
      if (!shortestEntry || wc < shortestEntry.wordCount) {
        shortestEntry = { id: e.id, title: e.slug, wordCount: wc };
      }

      if (e.mood) {
        moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
      }

      const dateObj = new Date(e.entryDate || e.createdAt);
      if (!isNaN(dateObj.getTime())) {
        const ym = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[dateObj.getDay()];
        weekdayCounts[dayName] = (weekdayCounts[dayName] || 0) + 1;

        const hour = dateObj.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        const dateStr = dateObj.toISOString().split("T")[0];
        if (!calendarMap[dateStr]) calendarMap[dateStr] = { count: 0, wordCount: 0 };
        calendarMap[dateStr].count += 1;
        calendarMap[dateStr].wordCount += wc;
      }

      try {
        const parsedTags: string[] = JSON.parse(e.tags || "[]");
        parsedTags.forEach((t) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      } catch (err) {}
    });

    // Calculate Streaks
    const uniqueDates = Array.from(new Set(allEntries.map((e) => e.entryDate.split("T")[0]))).sort();
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of uniqueDates) {
      const curDate = new Date(dStr);
      if (prevDate) {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak += 1;
        } else {
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak;
      prevDate = curDate;
    }

    // Check if current streak extends to today or yesterday
    if (uniqueDates.length > 0) {
      const lastDate = new Date(uniqueDates[uniqueDates.length - 1]);
      const now = new Date();
      const diffToday = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffToday <= 1) {
        currentStreak = tempStreak;
      }
    }

    // Attachments & Assets count
    const [assetRows] = await Promise.all([db.select({ total: count() }).from(journalEntryAssets)]);
    const attachmentsCount = assetRows[0]?.total ?? 0;

    // Entity Mentions (Locations, Trips, People)
    const locationCounts: Record<string, number> = {};
    const tripCounts: Record<string, number> = {};
    filtered.forEach((e) => {
      if (e.locationId) locationCounts[e.locationId] = (locationCounts[e.locationId] || 0) + 1;
      if (e.tripId) tripCounts[e.tripId] = (tripCounts[e.tripId] || 0) + 1;
    });

    const [allLocs, allTripsList, allPeople] = await Promise.all([
      db.select().from(locations),
      db.select().from(trips),
      db.select().from(persons),
    ]);

    const locMap = new Map(allLocs.map((l) => [l.id, l.name]));
    const tripMap = new Map(allTripsList.map((t) => [t.id, t.title]));

    const mostMentionedLocations = Object.entries(locationCounts)
      .map(([id, cnt]) => ({ id, name: locMap.get(id) || id, count: cnt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const mostMentionedTrips = Object.entries(tripCounts)
      .map(([id, cnt]) => ({ id, name: tripMap.get(id) || id, count: cnt }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const personCounts: Record<string, { name: string; count: number }> = {};
    allPeople.forEach((p) => {
      const fullName = (p.displayName || p.name || `${p.firstName || ""} ${p.lastName || ""}`).trim();
      if (!fullName) return;
      let cnt = 0;
      filtered.forEach((e) => {
        if (e.encryptedContent && e.encryptedContent.toLowerCase().includes(fullName.toLowerCase())) {
          cnt += 1;
        }
      });
      if (cnt > 0) personCounts[p.id] = { name: fullName, count: cnt };
    });

    const mostMentionedPeople = Object.entries(personCounts)
      .map(([id, obj]) => ({ id, name: obj.name, count: obj.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEntries,
      wordsWritten,
      charactersWritten,
      averageEntryLengthWords: totalEntries > 0 ? Math.round(wordsWritten / totalEntries) : 0,
      longestEntry,
      shortestEntry,
      streakDays: currentStreak,
      longestStreakDays: maxStreak,
      entriesByMonth: Object.entries(monthCounts).map(([month, cnt]) => ({ month, count: cnt })),
      entriesByWeekday: Object.entries(weekdayCounts).map(([day, cnt]) => ({ day, count: cnt })),
      entriesByHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourCounts[h] || 0 })),
      moodDistribution: Object.entries(moodCounts).map(([mood, cnt]) => ({ mood, count: cnt })),
      writingCalendar: Object.entries(calendarMap).map(([date, val]) => ({ date, count: val.count, wordCount: val.wordCount })),
      inlineImagesCount: attachmentsCount,
      attachmentsCount,
      mostUsedTags: Object.entries(tagCounts)
        .map(([tag, cnt]) => ({ tag, count: cnt }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      mostMentionedPeople,
      mostMentionedLocations,
      mostMentionedTrips,
    };
  },
};
