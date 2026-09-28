import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import type { Accessory } from "@/lib/accessories"
import { upsertAccessory } from "@/lib/inventory-repository"

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
  const { id } = await params
  const item = (await request.json()) as Accessory
  const saved = await upsertAccessory({ ...item, id })
  revalidatePath("/dashboard")
  revalidatePath(accessoryPaths[saved.kind])
  return NextResponse.json(saved)
}
