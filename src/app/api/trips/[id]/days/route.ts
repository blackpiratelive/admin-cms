import { NextResponse } from "next/server";
import { getTripByIdOrSlug } from "@/features/trips/actions";
import {
  getTripDaysAction,
  addTripDayAction,
  generateTripDaysFromDatesAction,
} from "@/features/trips/day-actions";

export const dynamic = "force-dynamic";

async function resolveTripId(idOrSlug: string): Promise<string | null> {
  const trip = await getTripByIdOrSlug(idOrSlug);
  return trip?.id ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripId = await resolveTripId(id);
    if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const days = await getTripDaysAction(tripId);
    return NextResponse.json({ days });
  } catch (error: any) {
    console.error("Failed to fetch trip days:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripId = await resolveTripId(id);
    if (!tripId) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    if (body?.generate === true) {
      const days = await generateTripDaysFromDatesAction(tripId);
      return NextResponse.json({ days }, { status: 201 });
    }

    await addTripDayAction(tripId, { date: body?.date });
    const days = await getTripDaysAction(tripId);
    return NextResponse.json({ days }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to add trip day:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
