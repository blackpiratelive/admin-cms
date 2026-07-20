import { NextRequest, NextResponse } from "next/server";
import { validatePassword, generateSessionToken, createSession } from "@/features/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || !validatePassword(password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await generateSessionToken();
    await createSession();

    return NextResponse.json({
      success: true,
      token,
      message: "Authenticated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Authentication failed" }, { status: 500 });
  }
}
