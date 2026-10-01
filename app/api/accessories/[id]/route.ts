import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import type { Accessory } from "@/lib/accessories"
import { saveErrorResponse } from "@/lib/api-errors"
import { verifySession } from "@/lib/auth/session"
import { upsertAccessory } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

const accessoryPaths = {
  headset: "/dashboard/headsets",
  mouse: "/dashboard/mice",
  monitor: "/dashboard/monitors",
  bag: "/dashboard/laptop-bags",
} as const

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const item = (await request.json()) as Accessory
  try {
    const saved = await upsertAccessory({ ...item, id })
    revalidatePath("/dashboard")
    revalidatePath(accessoryPaths[saved.kind])
    return NextResponse.json(saved)
  } catch (error) {
    return saveErrorResponse(error)
  }
}
