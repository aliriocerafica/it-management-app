import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { withStatusEmail } from "@/lib/asset-request-notify"
import {
  clearRequestOverride,
  getAssetRequest,
  saveRequestOverride,
} from "@/lib/asset-request-repository"
import { requestStatuses, type RequestStatus } from "@/lib/asset-requests"
import { verifySession } from "@/lib/auth/session"
import { getDtrAssetRequest } from "@/lib/dtr"

export const dynamic = "force-dynamic"

async function readBody(request: Request) {
  return (await request.json().catch(() => null)) as {
    id?: string
    status?: string
    note?: string | null
  } | null
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await readBody(request)
  const id = body?.id?.trim() ?? ""
  if (!id) return NextResponse.json({ error: "Request id is required." }, { status: 400 })

  const status = (body?.status?.trim() || "Archived") as RequestStatus
  if (!requestStatuses.includes(status)) {
    return NextResponse.json({ error: "Choose a valid status." }, { status: 400 })
  }

  await saveRequestOverride(id, status, body?.note)
  const current =
    (await getAssetRequest(id)) ??
    (await getDtrAssetRequest(id).catch(() => null))
  if (current) {
    await withStatusEmail(
      {
        ...current,
        status,
        resolutionNote: body?.note?.trim() || current.resolutionNote,
      },
      current.status,
    )
  }
  revalidatePath("/dashboard/requests")
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const id = (await readBody(request))?.id?.trim() ?? ""
  if (!id) return NextResponse.json({ error: "Request id is required." }, { status: 400 })

  await clearRequestOverride(id)
  revalidatePath("/dashboard/requests")
  return NextResponse.json({ ok: true })
}
