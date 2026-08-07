import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { locations } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();
    const list = await db.select().from(locations).orderBy(desc(locations.name));
    return NextResponse.json({ locations: list });
  } catch (error: any) {
    console.error("Failed to fetch locations:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch locations" }, { status: 500 });
  }
}
