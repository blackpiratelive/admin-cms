import { NextResponse } from "next/server";
import { db, ensureDbInitialized } from "@/db";
import { trips } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  getTripsOverviewAction,
  createTrip,
  updateTrip,
} from "@/features/trips/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureDbInitialized();

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");

    // Rich overview projection for mobile/dashboard clients.
    if (view === "overview") {
      const overview = await getTripsOverviewAction();
      return NextResponse.json({ trips: overview });
    }

    // Default: raw trip records (backwards-compatible picker payload).
    const list = await db.select().from(trips).orderBy(desc(trips.startDate));
    return NextResponse.json({ trips: list });
  } catch (error: any) {
    console.error("Failed to fetch trips:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.id) {
      const updated = await updateTrip(body.id, body);
      if (!updated) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      return NextResponse.json({ trip: updated }, { status: 200 });
    }

    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const created = await createTrip(body);
    return NextResponse.json({ trip: created }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to save trip:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save trip" },
      { status: 400 }
    );
  }
}
