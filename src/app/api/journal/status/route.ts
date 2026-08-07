import { NextResponse } from "next/server";
import { getJournalKeyRecord, getJournalSettings } from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [keyRecord, settingsRecord] = await Promise.all([
      getJournalKeyRecord(),
      getJournalSettings(),
    ]);

    const isInitialized = !!(keyRecord && settingsRecord);
    return NextResponse.json({
      isInitialized,
      keyRecord,
      settingsRecord,
    });
  } catch (error: any) {
    console.error("Journal status error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch status" }, { status: 500 });
  }
}
