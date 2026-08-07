import { NextResponse } from "next/server";
import {
  createJournalAssetAction,
  getJournalAssetsForEntryAction,
  deleteJournalAssetAction,
} from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get("entryId");
    if (!entryId) {
      return NextResponse.json({ error: "entryId query parameter required" }, { status: 400 });
    }

    const assets = await getJournalAssetsForEntryAction(entryId);
    return NextResponse.json({ assets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await createJournalAssetAction(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create asset" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId");
    if (!assetId) {
      return NextResponse.json({ error: "assetId query parameter required" }, { status: 400 });
    }

    await deleteJournalAssetAction(assetId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete asset" }, { status: 500 });
  }
}
