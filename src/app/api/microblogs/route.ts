import { NextResponse } from "next/server";
import { db } from "@/db";
import { microblogs, relatedMicroblogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rawPosts = await db
      .select({
        id: microblogs.id,
        slug: microblogs.slug,
        contentMarkdown: microblogs.contentMarkdown,
        publishedAt: microblogs.publishedAt,
        tags: microblogs.tags,
        coverImageUrl: microblogs.coverImageUrl,
        images: microblogs.images,
      })
      .from(microblogs)
      .where(eq(microblogs.status, "published"))
      .orderBy(desc(microblogs.publishedAt));

    // Fetch all related posts mapping
    const relations = await db
      .select({
        microblogId: relatedMicroblogs.microblogId,
        relatedSlug: microblogs.slug,
      })
      .from(relatedMicroblogs)
      .innerJoin(microblogs, eq(relatedMicroblogs.relatedMicroblogId, microblogs.id));

    // Map relations by microblogId
    const relationsMap: Record<string, string[]> = {};
    for (const rel of relations) {
      if (!relationsMap[rel.microblogId]) {
        relationsMap[rel.microblogId] = [];
      }
      relationsMap[rel.microblogId].push(rel.relatedSlug);
    }

    const posts = rawPosts.map((post) => {
      let parsedTags = [];
      try {
        parsedTags = JSON.parse(post.tags);
      } catch (e) {
        // Fallback
      }

      let parsedImages = [];
      try {
        parsedImages = JSON.parse(post.images);
      } catch (e) {
        // Fallback
      }

      return {
        ...post,
        tags: parsedTags,
        images: parsedImages,
        relatedPosts: relationsMap[post.id] || [],
      };
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Failed to fetch microblogs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
