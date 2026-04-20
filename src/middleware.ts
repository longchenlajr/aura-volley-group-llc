import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const host = req.headers.get("host") || "";
  const { pathname } = req.nextUrl;

  // Domain rewrite: longvolleyball.com → /longvolleyball prefix
  if (
    host.includes("longvolleyball") &&
    !pathname.startsWith("/longvolleyball")
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
