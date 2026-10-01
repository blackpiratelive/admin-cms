import { NextResponse } from "next/server";
import {
  getTripByIdOrSlug,
  connectTripToLocation,
  connectTripToPerson,
  removeTripConnectionAction,
} from "@/features/trips/actions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trip = await getTripByIdOrSlug(id);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const body = await request.json();
    const { targetType, targetId } = body;
    if (!targetType || !targetId) {
      return NextResponse.json({ error: "targetType and targetId are required" }, { status: 400 });
    }

    let result: { success: boolean; error?: string };
    if (targetType === "location") {
      result = await connectTripToLocation(trip.id, targetId);
    } else if (targetType === "person") {
      result = await connectTripToPerson(trip.id, targetId);
    } else {
      return NextResponse.json({ error: `Unsupported targetType: ${targetType}` }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to connect" }, { status: 400 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to connect entity to trip:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trip = await getTripByIdOrSlug(id);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    let relationshipId = searchParams.get("relationshipId");
    if (!relationshipId) {
      try {
        const body = await request.json();
        relationshipId = body.relationshipId;
      } catch {}
    }
    if (!relationshipId) {
      return NextResponse.json({ error: "relationshipId is required" }, { status: 400 });
    }

    const result = await removeTripConnectionAction(relationshipId, trip.id, trip.slug);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to remove connection" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to remove trip connection:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
