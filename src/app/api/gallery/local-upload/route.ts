import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/features/auth/session";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function PUT(req: NextRequest) {
  const isAuth = await getSession();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key query parameter" }, { status: 400 });
    }

    // Prevent directory traversal attacks
    const sanitizedKey = key.replace(/\.\./g, "");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadDir, sanitizedKey);

    await mkdir(path.dirname(filePath), { recursive: true });

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${sanitizedKey}`;
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    console.error("Local upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
