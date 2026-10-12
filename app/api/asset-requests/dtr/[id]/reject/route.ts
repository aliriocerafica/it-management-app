import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { withDenialEmail, withStatusEmail } from "@/lib/asset-request-notify"
import type { RequestStatus } from "@/lib/asset-requests"
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
    // Set only on the local-override fallback, where we already fetch the
    // current row and so can avoid re-emailing if a retry lands on a
    // request that's already Denied.
    let previousStatus: RequestStatus | undefined
    try {
      saved = await rejectDtrAssetRequest(id, note)
    } catch (error) {
      if (!isMissingDtrEndpoint(error)) throw error
      const current = await getDtrAssetRequest(id)
      previousStatus = current.status
      await saveRequestOverride(id, "Denied", note)
      saved = {
        ...current,
        status: "Denied" as const,
        cancelledAt: current.cancelledAt ?? new Date().toISOString(),
        resolutionNote: note,
      }
    }
    const payload =
      previousStatus !== undefined
        ? await withStatusEmail(saved, previousStatus)
        : await withDenialEmail(saved)
    revalidatePath("/dashboard/requests")
    return NextResponse.json(payload)
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
