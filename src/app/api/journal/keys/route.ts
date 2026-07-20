import { NextRequest, NextResponse } from "next/server";
import { getJournalKeyRecord, saveJournalKeyRecord } from "@/features/journal/actions";

export async function GET() {
  try {
    const keys = await getJournalKeyRecord();
    return NextResponse.json({ keys });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch journal keys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const keys = await saveJournalKeyRecord(body);
    return NextResponse.json({ keys });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save journal keys" }, { status: 500 });
  }
}
