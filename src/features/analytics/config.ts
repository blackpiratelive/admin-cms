import { MemoryIndexWeights, TimeFilterRange, CustomDateRange } from "./types";

export const DEFAULT_MEMORY_INDEX_WEIGHTS: MemoryIndexWeights = {
  richnessWeight: 0.25,
  diversityWeight: 0.20,
  longevityWeight: 0.15,
  recurrenceWeight: 0.15,
  recencyWeight: 0.10,
  favoriteBonusWeight: 0.08,
  pinnedBonusWeight: 0.07,
};

export const MEMORY_INDEX_WEIGHTS_KEY = "analytics_memory_weights";

export function getTimeFilterStartEnd(
  timeFilter?: TimeFilterRange,
  customRange?: CustomDateRange
): { start: Date | null; end: Date | null } {
  if (!timeFilter || timeFilter === "lifetime") {
    return { start: null, end: null };
  }

  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (timeFilter === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (timeFilter === "yesterday") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  } else if (timeFilter === "this_week") {
    const day = now.getDay();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - day), 23, 59, 59, 999);
  } else if (timeFilter === "last_week") {
    const day = now.getDay();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 7);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day - 1, 23, 59, 59, 999);
  } else if (timeFilter === "this_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (timeFilter === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (timeFilter === "this_year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (timeFilter === "last_year") {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (timeFilter === "custom" && customRange) {
    if (customRange.startDate) start = new Date(customRange.startDate);
    if (customRange.endDate) end = new Date(customRange.endDate);
  }

  return { start, end };
}
