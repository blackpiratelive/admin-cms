import { NextResponse } from "next/server";
import {
  getPersonMemoryHubDataAction,
  updatePersonAction,
  deletePersonAction,
} from "@/features/people/actions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getPersonMemoryHubDataAction(id);

    if (!data || !data.person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch person detail:", error);
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
    const result = await updatePersonAction(id, body);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to update person" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to update person:", error);
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
    const result = await deletePersonAction(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to delete person" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete person:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
