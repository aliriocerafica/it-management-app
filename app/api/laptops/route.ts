import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

import {
  deleteLaptops,
  listLaptops,
  upsertLaptop,
} from "@/lib/inventory-repository"
import type { Laptop } from "@/lib/laptops"
import { saveErrorResponse } from "@/lib/api-errors"
import { verifySession } from "@/lib/auth/session"

function refreshInventory() {
  revalidatePath("/dashboard", "layout")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/laptops")
  revalidatePath("/dashboard/analytics")
  revalidatePath("/dashboard/remote-access")
  // Deleting a laptop returns the RAM installed in it to stock.
  revalidatePath("/dashboard/ram")
}

export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const laptops = await listLaptops()
  return NextResponse.json(laptops)
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const laptop = (await request.json()) as Laptop
  try {
    const saved = await upsertLaptop(laptop)
    refreshInventory()
    return NextResponse.json(saved)
  } catch (error) {
    return saveErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { ids } = (await request.json()) as { ids: string[] }
  await deleteLaptops(ids)
  refreshInventory()
  return NextResponse.json({ ok: true })
}
