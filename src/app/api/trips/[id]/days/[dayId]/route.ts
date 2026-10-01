import { NextResponse } from "next/server";
import {
  updateTripDayAction,
  deleteTripDayAction,
} from "@/features/trips/day-actions";
import type { TripDayUpdate } from "@/features/trips/day-helpers";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const { dayId } = await params;
    const body = (await request.json()) as TripDayUpdate;
    const updated = await updateTripDayAction(dayId, body);
    if (!updated) return NextResponse.json({ error: "Day not found" }, { status: 404 });
    return NextResponse.json({ day: updated });
  } catch (error: any) {
    console.error("Failed to update trip day:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; dayId: string }> }
) {
  try {
    const { dayId } = await params;
    const ok = await deleteTripDayAction(dayId);
    if (!ok) return NextResponse.json({ error: "Day not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete trip day:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
