import { NextResponse } from "next/server";
import { getJournalEntries, createJournalEntry } from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await getJournalEntries();
    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("Failed to fetch journal entries:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch entries" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newEntry = await createJournalEntry(body);
    return NextResponse.json(newEntry, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create journal entry:", error);
    return NextResponse.json({ error: error.message || "Failed to create entry" }, { status: 400 });
  }
}
