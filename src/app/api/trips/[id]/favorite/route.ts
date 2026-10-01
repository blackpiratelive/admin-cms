import { NextResponse } from "next/server";
import {
  toggleTripFavoriteAction,
  getTripByIdOrSlug,
} from "@/features/trips/actions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const trip = await getTripByIdOrSlug(id);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Allow an explicit target state; otherwise flip the current value.
    let favorite: boolean;
    try {
      const body = await request.json();
      favorite =
        typeof body?.favorite === "boolean" ? body.favorite : trip.favorite !== 1;
    } catch {
      favorite = trip.favorite !== 1;
    }

    const result = await toggleTripFavoriteAction(trip.id, favorite);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to toggle trip favorite:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
