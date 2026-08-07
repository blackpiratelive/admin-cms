import { NextResponse } from "next/server";
import { getJournalSettings, saveJournalSettings } from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getJournalSettings();
    return NextResponse.json(settings || {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = await saveJournalSettings(body);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to save settings" }, { status: 500 });
  }
}
