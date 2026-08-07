import { NextResponse } from "next/server";
import { getJournalKeyRecord, saveJournalKeyRecord } from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const keyRecord = await getJournalKeyRecord();
    return NextResponse.json(keyRecord || {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch key record" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = await saveJournalKeyRecord(body);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save key record" }, { status: 500 });
  }
}
