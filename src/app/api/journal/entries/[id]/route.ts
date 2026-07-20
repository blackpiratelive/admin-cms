import { NextRequest, NextResponse } from "next/server";
import { getJournalEntryByIdOrSlug, updateJournalEntry, deleteJournalEntry } from "@/features/journal/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await getJournalEntryByIdOrSlug(id);
    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch journal entry" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateJournalEntry(id, body);
    return NextResponse.json({ entry: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update journal entry" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteJournalEntry(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete journal entry" }, { status: 500 });
  }
}
