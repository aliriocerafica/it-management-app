import { NextResponse } from "next/server"

import { verifySession } from "@/lib/auth/session"
import { listAssignedAssets } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const handler = new URL(request.url).searchParams.get("handler")?.trim()
  if (!handler) {
    return NextResponse.json({ error: "handler is required." }, { status: 400 })
  }

  const assigned = await listAssignedAssets(handler)
  return NextResponse.json({
    laptops: assigned.laptops.filter((item) => item.status === "In use"),
    accessories: assigned.accessories.filter((item) => item.status === "In use"),
  })
}
