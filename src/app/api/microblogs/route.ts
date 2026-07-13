import { NextResponse } from "next/server";
import { db } from "@/db";
import { microblogs } from "@/db/schema";
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
