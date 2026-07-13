import { db } from "@/db";
import { microblogs, relatedMicroblogs } from "@/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

// Common English stop words to filter out for keyword search
const STOP_WORDS = new Set([
  "the", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "could", "did", "do",
  "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", "having",
  "he", "her", "here", "hers", "him", "his", "how", "if", "in", "into", "is", "it", "its", "me", "more",
  "most", "my", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "our", "ours", "out",
  "over", "own", "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very",
  "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would",
  "you", "your", "yours", "yourself", "yourselves"
]);

function extractKeywords(content: string): Set<string> {
  const words = content
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/);
  
  const keywords = new Set<string>();
  for (const word of words) {
    // Only index meaningful keywords of 4+ characters
    if (word.length >= 4 && !STOP_WORDS.has(word)) {
      keywords.add(word);
    }
  }
  return keywords;
}

export async function updateRelatedPosts(postId: string, tags: string[], content: string) {
  // 1. Fetch all other microblog posts
  const allPosts = await db.select({
    id: microblogs.id,
    tags: microblogs.tags,
    contentMarkdown: microblogs.contentMarkdown,
  }).from(microblogs);

  const otherPosts = allPosts.filter(p => p.id !== postId);
  if (otherPosts.length === 0) return [];

  const currentKeywords = extractKeywords(content);
  const currentTags = new Set(tags.map(t => t.toLowerCase()));

  const scoredPosts: { id: string; score: number }[] = [];

  for (const post of otherPosts) {
    let score = 0;

    // A. Tag match: +5 points for each matching tag
    let postTags: string[] = [];
    try {
      postTags = JSON.parse(post.tags);
    } catch (e) {}

    for (const tag of postTags) {
      if (currentTags.has(tag.toLowerCase())) {
        score += 5;
      }
    }

    // B. Keyword match: +1 point for each matching keyword
    const postKeywords = extractKeywords(post.contentMarkdown);
    for (const kw of postKeywords) {
      if (currentKeywords.has(kw)) {
        score += 1;
      }
    }

    if (score > 0) {
      scoredPosts.push({ id: post.id, score });
    }
  }

  // Sort by score descending and take top 3
  scoredPosts.sort((a, b) => b.score - a.score);
  const topRelated = scoredPosts.slice(0, 3);

  // 2. Clear old relationships for this post (both directions)
  await db.delete(relatedMicroblogs).where(
    or(
      eq(relatedMicroblogs.microblogId, postId),
      eq(relatedMicroblogs.relatedMicroblogId, postId)
    )
  );

  // 3. Save new mutual bi-directional relationships
  for (const rel of topRelated) {
    // Save A -> B relation
    await db.insert(relatedMicroblogs).values({
      microblogId: postId,
      relatedMicroblogId: rel.id,
      score: rel.score,
    });

    // Save B -> A relation (mutual link)
    await db.insert(relatedMicroblogs).values({
      microblogId: rel.id,
      relatedMicroblogId: postId,
      score: rel.score,
    });
  }

  return topRelated;
}

export async function getRelatedPosts(postId: string) {
  const results = await db
    .select({
      id: microblogs.id,
      slug: microblogs.slug,
      contentMarkdown: microblogs.contentMarkdown,
      publishedAt: microblogs.publishedAt,
      status: microblogs.status,
      score: relatedMicroblogs.score,
    })
    .from(relatedMicroblogs)
    .innerJoin(microblogs, eq(relatedMicroblogs.relatedMicroblogId, microblogs.id))
    .where(eq(relatedMicroblogs.microblogId, postId))
    .orderBy(desc(relatedMicroblogs.score));

  return results;
}
