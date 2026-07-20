import { NextRequest, NextResponse } from "next/server";
import { getJournalSettings, saveJournalSettings } from "@/features/journal/actions";

export async function GET() {
  try {
    const settings = await getJournalSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch journal settings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = await saveJournalSettings(body);
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save journal settings" }, { status: 500 });
  }
}
