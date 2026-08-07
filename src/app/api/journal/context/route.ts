import { NextResponse } from "next/server";
import { getJournalContextualData } from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const data = await getJournalContextualData(dateStr);
    return NextResponse.json({
      photosCount: data.photos?.length || 0,
      moviesCount: data.movies?.length || 0,
      scrobblesCount: data.scrobbles?.length || 0,
      microblogsCount: data.microblogs?.length || 0,
      ...data,
    });
  } catch (error: any) {
    console.error("Failed to fetch journal contextual data:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch context" }, { status: 500 });
  }
}
