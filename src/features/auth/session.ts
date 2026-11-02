import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "cms_session";
const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "admin-cms-super-secret-key-32charsmin!!"
);

export interface SessionUser {
  userId: string;
  username: string;
  email?: string | null;
  role: "superadmin" | "user";
}

export async function generateSessionToken(user?: Partial<SessionUser>): Promise<string> {
  const payload = {
    userId: user?.userId || "superadmin",
    username: user?.username || "admin",
    email: user?.email || null,
    role: user?.role || "superadmin",
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function createSession(user?: Partial<SessionUser>) {
  const token = await generateSessionToken(user);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function verifyAndDecodeSession(token: string): Promise<SessionUser | null> {
  try {
    const verified = await jwtVerify(token, SECRET_KEY);
    const p = verified.payload as any;
    if (!p) return null;
    return {
      userId: p.userId || "superadmin",
      username: p.username || "admin",
      email: p.email || null,
      role: p.role === "user" ? "user" : "superadmin", // maps legacy "admin" to "superadmin"
    };
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const user = await verifyAndDecodeSession(token);
  return !!user;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAndDecodeSession(token);
}

export async function getSession(): Promise<boolean> {
  const user = await getSessionUser();
  return !!user;
}

export function validatePassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  return password === adminPassword;
}
