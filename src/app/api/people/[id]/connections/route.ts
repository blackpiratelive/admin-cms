import { NextResponse } from "next/server";
import {
  connectPersonToEntityAction,
  connectPersonPhotosBatchAction,
  removePersonEntityConnectionAction,
  BatchPhotoConnectItem,
} from "@/features/people/actions";
import { addItemToCollectionAction } from "@/features/libraries/actions/collections";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if batch photos payload is provided
    if (body.photos && Array.isArray(body.photos)) {
      const result = await connectPersonPhotosBatchAction(
        id,
        body.photos as BatchPhotoConnectItem[],
        body.relationship || "appears_in"
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to connect photos" }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }

    const { targetType, targetId, relationship, url, title, publicId } = body;

    // Single Cloudinary photo connection support
    if (targetType === "cloudinary" || targetType === "attachment") {
      const result = await connectPersonPhotosBatchAction(
        id,
        [{ type: "cloudinary", url: url || targetId, title, publicId }],
        relationship || "photo"
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to connect photo" }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: "targetType and targetId (or photos array) are required" },
        { status: 400 }
      );
    }

    if (targetType === "collection") {
      const result = await addItemToCollectionAction(targetId, "person", id);
      return NextResponse.json(result);
    } else {
      const result = await connectPersonToEntityAction(
        id,
        targetType,
        targetId,
        relationship || "connected_to"
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to create connection" }, { status: 400 });
      }
      return NextResponse.json(result, { status: 201 });
    }
  } catch (error: any) {
    console.error("Failed to connect entity to person:", error);
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
    const { searchParams } = new URL(request.url);
    let relationshipId = searchParams.get("relationshipId");

    if (!relationshipId) {
      try {
        const body = await request.json();
        relationshipId = body.relationshipId;
      } catch (_) {}
    }

    if (!relationshipId) {
      return NextResponse.json(
        { error: "relationshipId is required" },
        { status: 400 }
      );
    }

    const result = await removePersonEntityConnectionAction(relationshipId, id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to remove entity connection:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
