import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAndDecodeSession } from "./features/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login route, public API, status endpoint, and static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/journal/status") ||
    pathname.startsWith("/api/microblogs") ||
    pathname.startsWith("/api/gallery") ||
    pathname === "/collections" ||
    pathname.startsWith("/collections/") ||
    (pathname.startsWith("/gallery/") && pathname.split("/").filter(Boolean).length === 2) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const sessionToken = request.cookies.get("cms_session")?.value || bearerToken;
  const sessionUser = sessionToken ? await verifyAndDecodeSession(sessionToken) : null;

  if (!sessionUser) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Non-superadmin accounts have zero module access by default
  if (sessionUser.role !== "superadmin") {
    // Only permit root dashboard ("/") and auth endpoints
    if (pathname !== "/" && !pathname.startsWith("/api/auth")) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden: No module access assigned." },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
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
