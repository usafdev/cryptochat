import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  void request.nextUrl.pathname;
  const response = NextResponse.next();

  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http: https:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()" );
  response.headers.set("Cache-Control", "no-store");

  return response;
}

export const config = {
  matcher: "/:path*",
};
