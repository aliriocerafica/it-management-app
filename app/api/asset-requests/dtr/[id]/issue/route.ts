import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { verifySession } from "@/lib/auth/session"
import {
  dtrIssueConditions,
  issueDtrAssetRequest,
  type DtrIssueCondition,
} from "@/lib/dtr"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    serialNumber?: string
    conditionIssued?: string
  } | null
  const serialNumber = body?.serialNumber?.trim() ?? ""
  const conditionIssued = body?.conditionIssued
  if (serialNumber.length < 3 || serialNumber.length > 100) {
    return NextResponse.json(
      { error: "Serial number must be 3–100 characters." },
      { status: 400 },
    )
  }
  if (!dtrIssueConditions.includes(conditionIssued as DtrIssueCondition)) {
    return NextResponse.json({ error: "Choose a condition." }, { status: 400 })
  }

  try {
    const saved = await issueDtrAssetRequest(id, {
      serialNumber,
      conditionIssued: conditionIssued as DtrIssueCondition,
    })
    revalidatePath("/dashboard/requests")
    return NextResponse.json(saved)
  } catch (error) {
    console.error("DTR issue failed", error)
    const message = error instanceof Error ? error.message : "Couldn't issue this asset in DTR."
    const status = /not found/i.test(message) ? 404 : /already|approved/i.test(message) ? 409 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
