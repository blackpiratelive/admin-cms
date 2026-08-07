import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { trips } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();
    const list = await db.select().from(trips).orderBy(desc(trips.startDate));
    return NextResponse.json({ trips: list });
  } catch (error: any) {
    console.error("Failed to fetch trips:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch trips" }, { status: 500 });
  }
}
