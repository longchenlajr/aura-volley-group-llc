import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const host = req.headers.get("host") || "";
  const { pathname } = req.nextUrl;

  // longvolleyball.com: strip /longvolleyball prefix from URL (redirect)
  if (
    host.includes("longvolleyball") &&
    pathname.startsWith("/longvolleyball")
  ) {
    const clean = pathname.replace(/^\/longvolleyball/, "") || "/";
    const url = req.nextUrl.clone();
    url.pathname = clean;
    // Preserve query string
    return NextResponse.redirect(url, 308);
  }

  // longvolleyball.com: add /longvolleyball prefix internally (rewrite)
  if (
    host.includes("longvolleyball") &&
    !pathname.startsWith("/longvolleyball") &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/admin")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = `/longvolleyball${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Admin auth: protect /admin/* except /admin/login
  if (
    pathname.startsWith("/admin") &&
    !pathname.startsWith("/admin/login")
  ) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|img/|fonts/|api/auth).*)",
  ],
};
