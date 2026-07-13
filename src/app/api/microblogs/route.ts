import { NextResponse } from "next/server";
import { db } from "@/db";
import { microblogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const posts = await db
      .select({
        id: microblogs.id,
        slug: microblogs.slug,
        contentMarkdown: microblogs.contentMarkdown,
        publishedAt: microblogs.publishedAt,
        tags: microblogs.tags,
        coverImageUrl: microblogs.coverImageUrl,
      })
      .from(microblogs)
      .where(eq(microblogs.status, "published"))
      .orderBy(desc(microblogs.publishedAt));

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Failed to fetch microblogs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
