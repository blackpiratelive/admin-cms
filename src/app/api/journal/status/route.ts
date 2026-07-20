import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "admin-cms",
    module: "journal",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
