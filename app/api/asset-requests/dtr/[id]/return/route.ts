import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { verifySession } from "@/lib/auth/session"
import {
  dtrReturnConditions,
  returnDtrAssetRequest,
  type DtrReturnCondition,
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
    returnCondition?: string
  } | null
  const returnCondition = body?.returnCondition
  if (!dtrReturnConditions.includes(returnCondition as DtrReturnCondition)) {
    return NextResponse.json({ error: "Choose a return condition." }, { status: 400 })
  }

  try {
    const saved = await returnDtrAssetRequest(id, returnCondition as DtrReturnCondition)
    revalidatePath("/dashboard/requests")
    return NextResponse.json(saved)
  } catch (error) {
    console.error("DTR return failed", error)
    const message = error instanceof Error ? error.message : "Couldn't mark this asset returned in DTR."
    const status = /not found/i.test(message) ? 404 : /not been issued/i.test(message) ? 409 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
