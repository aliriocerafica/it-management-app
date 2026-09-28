import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

import {
  deleteLaptops,
  listLaptops,
  upsertLaptop,
} from "@/lib/inventory-repository"
import type { Laptop } from "@/lib/laptops"

function refreshInventory() {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/laptops")
  revalidatePath("/dashboard/analytics")
}

export async function GET() {
  const laptops = await listLaptops()
  return NextResponse.json(laptops)
}

export async function POST(request: Request) {
  const laptop = (await request.json()) as Laptop
  const saved = await upsertLaptop(laptop)
  refreshInventory()
  return NextResponse.json(saved)
}

export async function DELETE(request: Request) {
  const { ids } = (await request.json()) as { ids: string[] }
  await deleteLaptops(ids)
  refreshInventory()
  return NextResponse.json({ ok: true })
}
