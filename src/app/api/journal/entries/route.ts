import { NextRequest, NextResponse } from "next/server";
import { getJournalEntries, createJournalEntry } from "@/features/journal/actions";
import { ensureDbInitialized, db } from "@/db";
import { journalEntries } from "@/db/schema";
import { gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");

    if (since) {
      await ensureDbInitialized();
      const entries = await db
        .select()
        .from(journalEntries)
        .where(gte(journalEntries.updatedAt, since));
      return NextResponse.json({ entries });
    }

    const entries = await getJournalEntries();
    return NextResponse.json({ entries });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch journal entries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const entry = await createJournalEntry(body);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create journal entry" }, { status: 500 });
  }
}
