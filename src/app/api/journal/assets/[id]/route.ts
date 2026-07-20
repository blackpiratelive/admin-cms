import { NextRequest, NextResponse } from "next/server";
import { getJournalAssetByIdAction, deleteJournalAssetAction } from "@/features/journal/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await getJournalAssetByIdAction(id);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json({ asset });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch asset" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteJournalAssetAction(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete asset" }, { status: 500 });
  }
}
