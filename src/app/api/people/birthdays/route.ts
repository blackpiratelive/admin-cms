import { NextResponse } from "next/server";
import { getUpcomingBirthdaysAction } from "@/features/people/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const upcoming = await getUpcomingBirthdaysAction(limit);
    return NextResponse.json({ upcoming });
  } catch (error: any) {
    console.error("Failed to fetch upcoming birthdays:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
