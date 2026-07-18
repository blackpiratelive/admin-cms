import { JournalEntryRecord } from "@/db/schema";
import { DecryptedEntryItem } from "./journal-search";

export interface JournalStats {
  totalEntries: number;
  totalWords: number;
  avgWordsPerEntry: number;
  longestEntryWords: number;
  currentStreak: number;
  longestStreak: number;
  entriesThisWeek: number;
  entriesThisMonth: number;
  favoriteCount: number;
  moodCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  monthlyCounts: Record<string, number>; // YYYY-MM -> count
}

export function calculateJournalStats(items: DecryptedEntryItem[]): JournalStats {
  const totalEntries = items.length;
  if (totalEntries === 0) {
    return {
      totalEntries: 0,
      totalWords: 0,
      avgWordsPerEntry: 0,
      longestEntryWords: 0,
      currentStreak: 0,
      longestStreak: 0,
      entriesThisWeek: 0,
      entriesThisMonth: 0,
      favoriteCount: 0,
      moodCounts: {},
      typeCounts: {},
      monthlyCounts: {},
    };
  }

  let totalWords = 0;
  let longestEntryWords = 0;
  let favoriteCount = 0;
  const moodCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const monthlyCounts: Record<string, number> = {};

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  let entriesThisWeek = 0;
  let entriesThisMonth = 0;

  // Extract unique sorted entry dates (YYYY-MM-DD)
  const uniqueDatesSet = new Set<string>();

  for (const item of items) {
    const rec = item.record;
    const wordCount = rec.wordCount || 0;
    totalWords += wordCount;
    if (wordCount > longestEntryWords) longestEntryWords = wordCount;

    if (rec.favorite === 1) favoriteCount++;

    if (rec.mood) {
      moodCounts[rec.mood] = (moodCounts[rec.mood] || 0) + 1;
    }

    if (rec.entryType) {
      typeCounts[rec.entryType] = (typeCounts[rec.entryType] || 0) + 1;
    }

    if (rec.entryDate) {
      uniqueDatesSet.add(rec.entryDate);

      const monthKey = rec.entryDate.substring(0, 7);
      monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;

      if (rec.entryDate >= sevenDaysAgo) entriesThisWeek++;
      if (monthKey === currentMonthStr) entriesThisMonth++;
    }
  }

  const sortedDates = Array.from(uniqueDatesSet).sort().reverse(); // newest first

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const todayStr = now.toISOString().split("T")[0];
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  let checkDate = new Date(now);

  // Check if today or yesterday has an entry to start active streak
  if (sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr)) {
    let curr = sortedDates.includes(todayStr) ? new Date(now) : yesterdayDate;
    while (true) {
      const dateStr = curr.toISOString().split("T")[0];
      if (sortedDates.includes(dateStr)) {
        currentStreak++;
        curr.setDate(curr.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak overall
  if (sortedDates.length > 0) {
    tempStreak = 1;
    longestStreak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const d1 = new Date(sortedDates[i]);
      const d2 = new Date(sortedDates[i + 1]);
      const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 1;
      }
    }
  }

  const avgWordsPerEntry = Math.round(totalWords / totalEntries);

  return {
    totalEntries,
    totalWords,
    avgWordsPerEntry,
    longestEntryWords,
    currentStreak,
    longestStreak,
    entriesThisWeek,
    entriesThisMonth,
    favoriteCount,
    moodCounts,
    typeCounts,
    monthlyCounts,
  };
}
