import { NextResponse } from "next/server";
import {
  getTripHubDataAction,
  getTripMapLocationsAction,
  updateTrip,
  deleteTrip,
} from "@/features/trips/actions";
import { getTripDaysAction } from "@/features/trips/day-actions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const hub = await getTripHubDataAction(id);
    if (!hub || !hub.trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Fetch itinerary days and ordered map stops in parallel.
    const [days, map] = await Promise.all([
      getTripDaysAction(hub.trip.id),
      getTripMapLocationsAction(hub.trip.id),
    ]);

    return NextResponse.json({
      trip: hub.trip,
      entities: hub.entities,
      days,
      map,
    });
  } catch (error: any) {
    console.error("Failed to fetch trip detail:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateTrip(id, body);

    if (!updated) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ trip: updated });
  } catch (error: any) {
    console.error("Failed to update trip:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTrip(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete trip:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
