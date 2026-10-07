import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import type { Accessory, AccessoryKind } from "@/lib/accessories"
import {
  deleteAccessories,
  listAccessories,
  upsertAccessory,
} from "@/lib/inventory-repository"
import { saveErrorResponse } from "@/lib/api-errors"
import { verifySession } from "@/lib/auth/session"

const accessoryPaths: Record<AccessoryKind, string> = {
  headset: "/dashboard/headsets",
  mouse: "/dashboard/mice",
  monitor: "/dashboard/monitors",
  bag: "/dashboard/laptop-bags",
  battery: "/dashboard/batteries",
  keyboard: "/dashboard/keyboards",
  ram: "/dashboard/ram",
}

function refreshInventory(kind?: AccessoryKind) {
  revalidatePath("/dashboard", "layout")
  revalidatePath("/dashboard")
  if (kind) revalidatePath(accessoryPaths[kind])
  // Installing or removing RAM changes a laptop's memory.
  if (kind === "ram" || !kind) revalidatePath("/dashboard/laptops")
}

export async function GET(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const kind = new URL(request.url).searchParams.get("kind") as AccessoryKind | null
  if (!kind || !Object.hasOwn(accessoryPaths, kind)) {
    return NextResponse.json({ error: "A valid kind is required" }, { status: 400 })
  }
  const items = await listAccessories(kind)
  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const item = (await request.json()) as Accessory
  try {
    const saved = await upsertAccessory(item)
    refreshInventory(item.kind)
    return NextResponse.json(saved)
  } catch (error) {
    return saveErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { ids } = (await request.json()) as { ids: string[] }
  await deleteAccessories(ids)
  refreshInventory()
  return NextResponse.json({ ok: true })
}
