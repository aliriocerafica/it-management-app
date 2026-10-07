import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import {
  clearRequestOverride,
  saveRequestOverride,
} from "@/lib/asset-request-repository"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

async function requestId(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string } | null
  const id = body?.id?.trim() ?? ""
  return id
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const id = await requestId(request)
  if (!id) return NextResponse.json({ error: "Request id is required." }, { status: 400 })

  await saveRequestOverride(id, "Archived")
  revalidatePath("/dashboard/requests")
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const id = await requestId(request)
  if (!id) return NextResponse.json({ error: "Request id is required." }, { status: 400 })

  await clearRequestOverride(id)
  revalidatePath("/dashboard/requests")
  return NextResponse.json({ ok: true })
}
