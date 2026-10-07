import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { notifyAssetRequestDenied } from "@/lib/asset-request-notify"
import { saveRequestOverride } from "@/lib/asset-request-repository"
import { verifySession } from "@/lib/auth/session"
import {
  getDtrAssetRequest,
  isMissingDtrEndpoint,
  rejectDtrAssetRequest,
} from "@/lib/dtr"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const body = (await request.json().catch(() => null)) as { note?: string } | null
  const note = body?.note?.trim() ?? ""
  if (!note) {
    return NextResponse.json({ error: "A reason is required to deny this request." }, { status: 400 })
  }

  try {
    let saved
    try {
      saved = await rejectDtrAssetRequest(id, note)
    } catch (error) {
      if (!isMissingDtrEndpoint(error)) throw error
      const current = await getDtrAssetRequest(id)
      await saveRequestOverride(id, "Denied", note)
      saved = {
        ...current,
        status: "Denied" as const,
        cancelledAt: current.cancelledAt ?? new Date().toISOString(),
        resolutionNote: note,
      }
    }
    await notifyAssetRequestDenied(saved)
    revalidatePath("/dashboard/requests")
    return NextResponse.json(saved)
  } catch (error) {
    console.error("DTR reject failed", error)
    const message =
      error instanceof Error ? error.message : "Couldn't deny this request in DTR."
    const status = /not found/i.test(message)
      ? 404
      : /already|rejected|cancelled/i.test(message)
        ? 409
        : 502
    return NextResponse.json({ error: message }, { status })
  }
}
