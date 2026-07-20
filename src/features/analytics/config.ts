import { MemoryIndexWeights } from "./types";

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
