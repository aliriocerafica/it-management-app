import { NextResponse } from "next/server"

import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  return NextResponse.json({ user })
}
