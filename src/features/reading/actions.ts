"use server";

import { db, ensureDbInitialized } from "@/db";
import { rssArticles, rssFeeds, rssCategories, relationships } from "@/db/schema";
import { eq, desc, and, gte, lte, like, or } from "drizzle-orm";

export interface ReadingArticleDTO {
  id: string;
  freshrssId: string;
  title: string;
  originalUrl: string;
  feedId?: string | null;
  feedName?: string | null;
  category?: string | null;
  author?: string | null;
  publicationDate?: string | null;
  readDate?: string | null;
  starredAt?: string | null;
  wordCount: number;
  readingTime: number;
  isRead: boolean;
  isStarred: boolean;
}

/**
 * Get reading history articles with optional filtering and pagination.
 */
export async function getReadingArticlesAction(options?: {
  filter?: "all" | "read" | "starred" | "unread";
  category?: string;
  feedName?: string;
  query?: string;
  page?: number;
  limit?: number;
}) {
  await ensureDbInitialized();

  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  const allArticles = await db.select().from(rssArticles);

  let filtered = allArticles;

  if (options?.filter === "read") {
    filtered = filtered.filter((a) => a.isRead === 1);
  } else if (options?.filter === "starred") {
    filtered = filtered.filter((a) => a.isStarred === 1);
  } else if (options?.filter === "unread") {
    filtered = filtered.filter((a) => a.isRead === 0);
  }

  if (options?.category) {
    filtered = filtered.filter((a) => a.category?.toLowerCase() === options.category?.toLowerCase());
  }

  if (options?.feedName) {
    filtered = filtered.filter((a) => a.feedName?.toLowerCase() === options.feedName?.toLowerCase());
  }

  if (options?.query && options.query.trim()) {
    const q = options.query.toLowerCase().trim();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.feedName && a.feedName.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q)) ||
        (a.author && a.author.toLowerCase().includes(q))
    );
  }

  // Sort by readDate / publicationDate descending
  filtered.sort((a, b) => {
    const dA = new Date(a.readDate || a.publicationDate || a.createdAt).getTime();
    const dB = new Date(b.readDate || b.publicationDate || b.createdAt).getTime();
    return dB - dA;
  });

  const total = filtered.length;
  const pageItems = filtered.slice(offset, offset + limit).map((a) => ({
    id: a.id,
    freshrssId: a.freshrssId,
    title: a.title,
    originalUrl: a.originalUrl,
    feedId: a.feedId,
    feedName: a.feedName,
    category: a.category,
    author: a.author,
    publicationDate: a.publicationDate,
    readDate: a.readDate,
    starredAt: a.starredAt,
    wordCount: a.wordCount,
    readingTime: a.readingTime,
    isRead: a.isRead === 1,
    isStarred: a.isStarred === 1,
  }));

  return {
    items: pageItems,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Reading Influence Engine: Find articles read or published around a given ISO date string (+/- 2 days or date range).
 */
export async function getReadingAroundTimeAction(
  dateIso: string,
  endDateIso?: string,
  limit = 6
): Promise<ReadingArticleDTO[]> {
  await ensureDbInitialized();

  if (!dateIso) return [];

  const targetStart = new Date(dateIso);
  let targetEnd = endDateIso ? new Date(endDateIso) : new Date(dateIso);

  if (!endDateIso) {
    // 2 days buffer before and after
    targetStart.setDate(targetStart.getDate() - 2);
    targetEnd.setDate(targetEnd.getDate() + 2);
  } else {
    // 1 day buffer around trip/event range
    targetStart.setDate(targetStart.getDate() - 1);
    targetEnd.setDate(targetEnd.getDate() + 1);
  }

  const allArticles = await db.select().from(rssArticles);

  const matched = allArticles.filter((art) => {
    const dateStr = art.readDate || art.publicationDate || art.createdAt;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= targetStart && d <= targetEnd;
  });

  matched.sort((a, b) => {
    // Prioritize starred articles and recent read dates
    if (a.isStarred !== b.isStarred) return b.isStarred - a.isStarred;
    const dA = new Date(a.readDate || a.publicationDate || a.createdAt).getTime();
    const dB = new Date(b.readDate || b.publicationDate || b.createdAt).getTime();
    return dB - dA;
  });

  return matched.slice(0, limit).map((a) => ({
    id: a.id,
    freshrssId: a.freshrssId,
    title: a.title,
    originalUrl: a.originalUrl,
    feedId: a.feedId,
    feedName: a.feedName,
    category: a.category,
    author: a.author,
    publicationDate: a.publicationDate,
    readDate: a.readDate,
    starredAt: a.starredAt,
    wordCount: a.wordCount,
    readingTime: a.readingTime,
    isRead: a.isRead === 1,
    isStarred: a.isStarred === 1,
  }));
}

/**
 * Get feeds and categories summary for reading filter bars.
 */
export async function getReadingMetadataAction() {
  await ensureDbInitialized();
  const [feedsList, categoriesList] = await Promise.all([
    db.select().from(rssFeeds),
    db.select().from(rssCategories),
  ]);

  return {
    feeds: feedsList,
    categories: categoriesList,
  };
}
