import { NextRequest, NextResponse } from "next/server";
import { createJournalAssetAction, getJournalAssetsForEntryAction } from "@/features/journal/actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");
    if (!entryId) {
      return NextResponse.json({ error: "entryId query parameter is required" }, { status: 400 });
    }
    const assets = await getJournalAssetsForEntryAction(entryId);
    return NextResponse.json({ assets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const asset = await createJournalAssetAction(body);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create journal asset" }, { status: 500 });
  }
}
