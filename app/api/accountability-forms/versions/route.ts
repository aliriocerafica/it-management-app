import { NextResponse } from "next/server"

import { listFormVersions } from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const holder = new URL(request.url).searchParams.get("holder")?.trim()
  if (!holder) return NextResponse.json({ error: "holder is required." }, { status: 400 })

  return NextResponse.json(await listFormVersions(holder))
}
