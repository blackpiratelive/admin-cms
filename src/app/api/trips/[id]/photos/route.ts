import { NextResponse } from "next/server";
import {
  getTripByIdOrSlug,
  connectTripPhotosBatchAction,
  removeTripPhotoConnectionAction,
} from "@/features/trips/actions";
import type { BatchPhotoConnectItem } from "@/components/PhotoPickerModal";

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
    const photos = (body.photos as BatchPhotoConnectItem[]) || [];
    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: "photos array is required" }, { status: 400 });
    }

    const result = await connectTripPhotosBatchAction(
      trip.id,
      photos,
      body.relationship || "taken_at"
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to connect photos" }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Failed to connect trip photos:", error);
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
    let connectionId = searchParams.get("connectionId");
    if (!connectionId) {
      try {
        const body = await request.json();
        connectionId = body.connectionId;
      } catch {}
    }
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    const result = await removeTripPhotoConnectionAction(connectionId, trip.id, trip.slug);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to remove photo" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to remove trip photo:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
