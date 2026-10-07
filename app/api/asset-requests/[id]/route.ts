import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { saveErrorResponse } from "@/lib/api-errors"
import { withDenialEmail } from "@/lib/asset-request-notify"
import {
  getAssetRequest,
  updateAssetRequest,
} from "@/lib/asset-request-repository"
import type { AssetRequest } from "@/lib/asset-requests"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const body = (await request.json()) as AssetRequest
  try {
    const previous = await getAssetRequest(id)
    const saved = await updateAssetRequest({ ...body, id })
    const payload =
      saved.status === "Denied" && previous?.status !== "Denied"
        ? await withDenialEmail(saved)
        : saved
    revalidatePath("/dashboard/requests")
    return NextResponse.json(payload)
  } catch (error) {
    return saveErrorResponse(error)
  }
}
