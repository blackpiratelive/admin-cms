import { NextResponse } from "next/server";
import { deleteMicroblogsBatch } from "@/features/microblog/actions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await deleteMicroblogsBatch(body.ids || []);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
