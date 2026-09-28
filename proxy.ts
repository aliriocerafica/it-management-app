import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { SESSION_COOKIE_NAME } from "@/lib/auth/constants"

const AUTH_PAGES = ["/login", "/forgot-password", "/reset-password"]

// Optimistic check only (cookie presence) — the real session validation
// (expiry, idle timeout, revocation) happens server-side in verifySession().
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME)
  const { pathname } = request.nextUrl
  const isDashboard = pathname.startsWith("/dashboard")
  const isAuthPage = AUTH_PAGES.includes(pathname)

  if (isDashboard && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/forgot-password", "/reset-password"],
}
