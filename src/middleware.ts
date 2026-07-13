import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "./features/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login route, public API, and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/microblogs") ||
    pathname.startsWith("/api/gallery") ||
    (pathname.startsWith("/gallery/") && pathname.split("/").filter(Boolean).length === 2) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("cms_session")?.value;
  const isValid = sessionToken ? await verifySessionToken(sessionToken) : false;

  if (!isValid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/login
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
