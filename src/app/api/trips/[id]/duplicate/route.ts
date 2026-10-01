import { NextResponse } from "next/server";
import { duplicateTripAction } from "@/features/trips/actions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const duplicated = await duplicateTripAction(id);

    if (!duplicated) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ trip: duplicated }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to duplicate trip:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
