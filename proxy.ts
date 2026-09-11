import { NextRequest, NextResponse } from "next/server";

/** Must match SESSION_COOKIE in lib/auth.ts. Do not import auth here — it opens SQLite. */
const SESSION_COOKIE = "xk_session";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/deploy/") ||
    // MCP authenticates with Authorization: Bearer <PAT>, not the session cookie.
    pathname === "/api/mcp" ||
    pathname.startsWith("/api/mcp/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  const next = pathname + request.nextUrl.search;
  if (next && next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
