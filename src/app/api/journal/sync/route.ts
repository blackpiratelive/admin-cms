import { NextRequest, NextResponse } from "next/server";
import { createJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalEntries } from "@/features/journal/actions";
import { ensureDbInitialized, db } from "@/db";
import { journalEntries } from "@/db/schema";
import { gte } from "drizzle-orm";

interface SyncItem {
  id?: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items = [], lastSyncedAt } = body as { items: SyncItem[]; lastSyncedAt?: string };

    const results: Array<{ id?: string; status: "success" | "error"; error?: string }> = [];

    for (const item of items) {
      try {
        if (item.operation === "CREATE" && item.payload) {
          const entry = await createJournalEntry(item.payload);
          results.push({ id: entry.id, status: "success" });
        } else if (item.operation === "UPDATE" && item.id && item.payload) {
          await updateJournalEntry(item.id, item.payload);
          results.push({ id: item.id, status: "success" });
        } else if (item.operation === "DELETE" && item.id) {
          await deleteJournalEntry(item.id);
          results.push({ id: item.id, status: "success" });
        }
      } catch (err: any) {
        results.push({ id: item.id, status: "error", error: err.message });
      }
    }

    await ensureDbInitialized();
    const serverEntries = lastSyncedAt
      ? await db.select().from(journalEntries).where(gte(journalEntries.updatedAt, lastSyncedAt))
      : await getJournalEntries();

    return NextResponse.json({
      processed: results,
      serverEntries,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Journal sync failed" }, { status: 500 });
  }
}
