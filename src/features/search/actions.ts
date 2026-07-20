"use server";

import { db, ensureDbInitialized } from "@/db";
import { searchIndex } from "@/db/schema";
import { like, or, sql } from "drizzle-orm";
import { rebuildSearchIndex } from "./search-index";

export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  url: string;
}

export async function searchEverything(query: string): Promise<SearchResultItem[]> {
  if (!query || query.trim().length < 2) return [];
  await ensureDbInitialized();

  const term = `%${query.trim().toLowerCase()}%`;

  // Item 18: Query 1 single unified search_index table instead of 10 separate queries
  let rows = await db
    .select()
    .from(searchIndex)
    .where(
      or(
        like(sql`LOWER(${searchIndex.title})`, term),
        like(sql`LOWER(${searchIndex.subtitle})`, term),
        like(sql`LOWER(${searchIndex.keywords})`, term)
      )
    )
    .limit(20);

  // Auto-populate index if search_index is currently empty
  if (rows.length === 0) {
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(searchIndex);

    if ((totalCount[0]?.count ?? 0) === 0) {
      await rebuildSearchIndex();
      rows = await db
        .select()
        .from(searchIndex)
        .where(
          or(
            like(sql`LOWER(${searchIndex.title})`, term),
            like(sql`LOWER(${searchIndex.subtitle})`, term),
            like(sql`LOWER(${searchIndex.keywords})`, term)
          )
        )
        .limit(20);
    }
  }

  // Memory Index Search Ranking Boost
  const memoryScores = await db.select().from(sql`analytics_memory_scores`);
  const scoreMap = new Map<string, number>();
  memoryScores.forEach((ms: any) => {
    if (ms.id && ms.final_score) {
      scoreMap.set(ms.id, ms.final_score);
    }
  });

  const sortedRows = [...rows].sort((a, b) => {
    const scoreA = scoreMap.get(`${a.entityType}_${a.entityId}`) || scoreMap.get(a.id) || 0;
    const scoreB = scoreMap.get(`${b.entityType}_${b.entityId}`) || scoreMap.get(b.id) || 0;
    return scoreB - scoreA;
  });

  return sortedRows.map((row) => ({
    id: row.entityId,
    type: row.entityType,
    title: row.title,
    subtitle: row.subtitle || undefined,
    url: row.url,
  }));
}
