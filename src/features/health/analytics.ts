import type { HealthTreatmentLogRecord } from "@/db/schema";
import type { TreatmentStreakAndAdherence } from "./types";

/**
 * Returns YYYY-MM-DD for a Date object or timestamp in local time.
 */
export function formatDateIso(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the week number (1-based) relative to a baseline start date.
 */
export function calculateWeekNumber(baselineDateStr: string, targetDateStr?: string): number {
  if (!baselineDateStr) return 1;
  const baseline = new Date(`${baselineDateStr}T00:00:00`);
  const target = targetDateStr ? new Date(`${targetDateStr}T00:00:00`) : new Date();

  const diffMs = target.getTime() - baseline.getTime();
  if (diffMs <= 0) return 1;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string.
 */
export function shiftDateIso(dateStr: string, dayDelta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + dayDelta);
  return formatDateIso(d);
}

/**
 * Calculates current streak, longest streak, and 30-day adherence rate.
 */
export function calculateStreakAndAdherence(params: {
  treatmentId: string;
  timesPerDay: number;
  startDate: string;
  logs: HealthTreatmentLogRecord[];
  targetUserId?: string;
  asOfDate?: string;
}): TreatmentStreakAndAdherence {
  const { treatmentId, timesPerDay, startDate, logs, targetUserId } = params;
  const todayStr = params.asOfDate || formatDateIso();

  // Map dates to completed doses for this treatment (optionally filtered by participant)
  const doseMap = new Map<string, number>();
  for (const log of logs) {
    if (
      log.treatmentId === treatmentId &&
      (!targetUserId || log.userId === targetUserId)
    ) {
      doseMap.set(log.logDate, (doseMap.get(log.logDate) || 0) + log.completedDoses);
    }
  }

  const isCompliant = (dateStr: string): boolean => {
    return (doseMap.get(dateStr) || 0) >= timesPerDay;
  };

  const todayCompletedDoses = doseMap.get(todayStr) || 0;
  const isTodayCompliant = todayCompletedDoses >= timesPerDay;

  // 1. Current Streak calculation
  let currentStreak = 0;
  if (isTodayCompliant) {
    currentStreak = 1;
    let checkDate = shiftDateIso(todayStr, -1);
    while (checkDate >= startDate && isCompliant(checkDate)) {
      currentStreak++;
      checkDate = shiftDateIso(checkDate, -1);
    }
  } else {
    // If today is not yet compliant, streak can continue from yesterday (today is still ongoing)
    const yesterdayStr = shiftDateIso(todayStr, -1);
    if (yesterdayStr >= startDate && isCompliant(yesterdayStr)) {
      currentStreak = 1;
      let checkDate = shiftDateIso(yesterdayStr, -1);
      while (checkDate >= startDate && isCompliant(checkDate)) {
        currentStreak++;
        checkDate = shiftDateIso(checkDate, -1);
      }
    }
  }

  // 2. Longest Streak calculation
  let longestStreak = 0;
  let runningStreak = 0;
  let cursor = startDate <= todayStr ? startDate : todayStr;

  while (cursor <= todayStr) {
    if (isCompliant(cursor)) {
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      runningStreak = 0;
    }
    cursor = shiftDateIso(cursor, 1);
  }

  // 3. 30-day Rolling Adherence Calculation
  let windowDays = 0;
  let compliantDaysInWindow = 0;
  let totalElapsedDays = 0;

  for (let i = 0; i < 30; i++) {
    const checkDate = shiftDateIso(todayStr, -i);
    if (checkDate < startDate) break; // Don't penalize for dates before treatment began
    windowDays++;
    if (isCompliant(checkDate)) {
      compliantDaysInWindow++;
    }
  }

  const adherenceRate30d =
    windowDays > 0 ? Math.round((compliantDaysInWindow / windowDays) * 100) : 0;

  // Total compliant days from start date to today
  let totalCompliantDays = 0;
  let countCursor = startDate <= todayStr ? startDate : todayStr;
  while (countCursor <= todayStr) {
    totalElapsedDays++;
    if (isCompliant(countCursor)) {
      totalCompliantDays++;
    }
    countCursor = shiftDateIso(countCursor, 1);
  }

  return {
    treatmentId,
    currentStreak,
    longestStreak,
    adherenceRate30d,
    totalCompliantDays,
    totalElapsedDays: Math.max(1, totalElapsedDays),
    todayCompletedDoses,
    timesPerDay,
    isTodayCompliant,
  };
}
