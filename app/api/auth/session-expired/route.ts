import { NextResponse } from "next/server"

import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

// Server Components can't delete cookies, so requireSession() sends invalid
// sessions here. Without clearing the cookie, the proxy (which only checks the
// cookie exists) bounces /login back to /dashboard forever.
export async function GET(request: Request) {
  const user = await verifySession()
  if (user) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
