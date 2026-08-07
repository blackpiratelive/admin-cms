import { NextResponse } from "next/server";
import { getEntityPickersData } from "@/features/journal/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getEntityPickersData();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch entity pickers data:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch pickers" }, { status: 500 });
  }
}
