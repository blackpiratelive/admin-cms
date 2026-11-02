import { NextRequest, NextResponse } from "next/server";
import { validatePassword, generateSessionToken, createSession } from "@/features/auth/session";
import { db, ensureDbInitialized } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, username, email, password } = body;
    const userIdentifier = (identifier || username || email || "").trim();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // 1. Super admin fallback
    if ((!userIdentifier || userIdentifier.toLowerCase() === "admin") && validatePassword(password)) {
      const token = await generateSessionToken({
        userId: "superadmin",
        username: "admin",
        role: "superadmin",
      });
      await createSession({
        userId: "superadmin",
        username: "admin",
        role: "superadmin",
      });
      return NextResponse.json({
        success: true,
        token,
        role: "superadmin",
        message: "Authenticated successfully",
      });
    }

    // 2. Database user lookup
    await ensureDbInitialized();
    const foundUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.username, userIdentifier), eq(users.email, userIdentifier)))
      .limit(1);

    if (foundUsers.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const user = foundUsers[0];
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const sessionPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: (user.role === "superadmin" ? "superadmin" : "user") as "superadmin" | "user",
    };

    const token = await generateSessionToken(sessionPayload);
    await createSession(sessionPayload);

    return NextResponse.json({
      success: true,
      token,
      role: sessionPayload.role,
      message: "Authenticated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Authentication failed" }, { status: 500 });
  }
}
