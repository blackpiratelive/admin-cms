import { MemoryIndexWeights, MemoryScoreBreakdown } from "./types";
import { DEFAULT_MEMORY_INDEX_WEIGHTS } from "./config";

export interface ComputeMemoryScoreInput {
  entityType: string; // 'trip' | 'location' | 'person' | 'journal' | 'gallery' | 'project'
  entityId: string;
  title: string;
  slug: string;
  itemCount: number; // count of connected sub-items / content
  wordCount?: number;
  distinctModulesCount: number; // e.g. 1 to 10
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  lastActivityDate?: string | null;
  recurrenceCount: number; // mentions or occurrences across system
  isFavorite: boolean;
  isPinned: boolean;
  metadata?: Record<string, any>;
}

export function computeMemoryScore(
  input: ComputeMemoryScoreInput,
  weights: MemoryIndexWeights = DEFAULT_MEMORY_INDEX_WEIGHTS
): MemoryScoreBreakdown {
  // 1. Richness Score (0 - 100)
  const contentCount = input.itemCount + Math.floor((input.wordCount || 0) / 100);
  const richnessScore = Math.min(100, Math.log2(contentCount + 1) * 20);

  // 2. Diversity Score (0 - 100)
  // Max distinct modules is 10
  const diversityScore = Math.min(100, (input.distinctModulesCount / 7) * 100);

  // 3. Longevity Score (0 - 100)
  let longevityDays = 1;
  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate).getTime();
    const end = new Date(input.endDate).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      longevityDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }
  } else if (input.createdAt && input.lastActivityDate) {
    const start = new Date(input.createdAt).getTime();
    const end = new Date(input.lastActivityDate).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      longevityDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    }
  }
  const longevityScore = Math.min(100, Math.log2(longevityDays + 1) * 15);

  // 4. Recurrence Score (0 - 100)
  const recurrenceScore = Math.min(100, Math.log2(input.recurrenceCount + 1) * 25);

  // 5. Recency Score (0 - 100)
  const refDate = input.lastActivityDate || input.createdAt || new Date().toISOString();
  const daysDiff = Math.max(0, (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, Math.min(100, 100 * Math.exp(-daysDiff / 90))); // 90-day decay half-life factor

  // 6. Favorite & Pinned Bonuses (0 or 100)
  const favoriteBonus = input.isFavorite ? 100 : 0;
  const pinnedBonus = input.isPinned ? 100 : 0;

  // Final Weighted Score
  const rawFinal =
    richnessScore * weights.richnessWeight +
    diversityScore * weights.diversityWeight +
    longevityScore * weights.longevityWeight +
    recurrenceScore * weights.recurrenceWeight +
    recencyScore * weights.recencyWeight +
    favoriteBonus * weights.favoriteBonusWeight +
    pinnedBonus * weights.pinnedBonusWeight;

  const finalScore = Number(Math.min(100, Math.max(0, rawFinal)).toFixed(2));

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    slug: input.slug,
    richnessScore: Number(richnessScore.toFixed(2)),
    diversityScore: Number(diversityScore.toFixed(2)),
    longevityScore: Number(longevityScore.toFixed(2)),
    recurrenceScore: Number(recurrenceScore.toFixed(2)),
    recencyScore: Number(recencyScore.toFixed(2)),
    favoriteBonus,
    pinnedBonus,
    finalScore,
    isPinned: input.isPinned,
    metadata: input.metadata || {},
    updatedAt: new Date().toISOString(),
  };
}
