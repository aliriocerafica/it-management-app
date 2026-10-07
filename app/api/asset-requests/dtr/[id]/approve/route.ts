import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { saveRequestOverride } from "@/lib/asset-request-repository"
import { verifySession } from "@/lib/auth/session"
import {
  approveDtrAssetRequest,
  getDtrAssetRequest,
  isMissingDtrEndpoint,
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
  const note = body?.note?.trim()

  try {
    let saved
    try {
      saved = await approveDtrAssetRequest(id, note)
    } catch (error) {
      if (!isMissingDtrEndpoint(error)) throw error
      const current = await getDtrAssetRequest(id)
      await saveRequestOverride(id, "Approved", note)
      saved = {
        ...current,
        status: "Approved" as const,
        approvedAt: current.approvedAt ?? new Date().toISOString(),
        resolutionNote: note || null,
      }
    }
    revalidatePath("/dashboard/requests")
    return NextResponse.json(saved)
  } catch (error) {
    console.error("DTR approve failed", error)
    const message =
      error instanceof Error ? error.message : "Couldn't approve this request in DTR."
    const status = /not found/i.test(message)
      ? 404
      : /already|approved|submitted/i.test(message)
        ? 409
        : 502
    return NextResponse.json({ error: message }, { status })
  }
}
