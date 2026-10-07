import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

import {
  createAssetRequest,
  deleteAssetRequests,
  listAssetRequests,
} from "@/lib/asset-request-repository"
import type { AssetRequest } from "@/lib/asset-requests"
import { saveErrorResponse } from "@/lib/api-errors"
import { withRequestEmail } from "@/lib/asset-request-notify"
import { verifySession } from "@/lib/auth/session"

export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  return NextResponse.json(await listAssetRequests())
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = (await request.json()) as AssetRequest
  if (!body.requesterName?.trim() || !body.assetType?.trim() || !body.reason?.trim()) {
    return NextResponse.json(
      { error: "Requester, asset type and reason are required." },
      { status: 400 },
    )
  }
  try {
    const saved = await createAssetRequest(body)
    const payload = await withRequestEmail(saved, "pending")
    revalidatePath("/dashboard/requests")
    return NextResponse.json(payload)
  } catch (error) {
    return saveErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { ids } = (await request.json()) as { ids: string[] }
  await deleteAssetRequests(ids)
  revalidatePath("/dashboard/requests")
  return NextResponse.json({ ok: true })
}
