import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import type { Accessory, AccessoryKind } from "@/lib/accessories"
import {
  deleteAccessories,
  listAccessories,
  upsertAccessory,
} from "@/lib/inventory-repository"
import { verifySession } from "@/lib/auth/session"

const accessoryPaths: Record<AccessoryKind, string> = {
  headset: "/dashboard/headsets",
  mouse: "/dashboard/mice",
  monitor: "/dashboard/monitors",
  bag: "/dashboard/laptop-bags",
}

function refreshInventory(kind?: AccessoryKind) {
  revalidatePath("/dashboard")
  if (kind) revalidatePath(accessoryPaths[kind])
}

export async function GET(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const kind = new URL(request.url).searchParams.get("kind") as AccessoryKind | null
  if (!kind) {
    return NextResponse.json({ error: "kind is required" }, { status: 400 })
  }
  const items = await listAccessories(kind)
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const item = (await request.json()) as Accessory
  const saved = await upsertAccessory(item)
  refreshInventory(item.kind)
  return NextResponse.json(saved)
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { ids } = (await request.json()) as { ids: string[] }
  await deleteAccessories(ids)
  refreshInventory()
  return NextResponse.json({ ok: true })
}
