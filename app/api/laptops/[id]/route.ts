import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { saveErrorResponse } from "@/lib/api-errors"
import { verifySession } from "@/lib/auth/session"
import { upsertLaptop } from "@/lib/inventory-repository"
import type { Laptop } from "@/lib/laptops"

export const dynamic = "force-dynamic"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const laptop = (await request.json()) as Laptop
  try {
    const saved = await upsertLaptop({ ...laptop, id })
    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/laptops")
    revalidatePath("/dashboard/analytics")
    revalidatePath("/dashboard/remote-access")
    return NextResponse.json(saved)
  } catch (error) {
    return saveErrorResponse(error)
  }
}
