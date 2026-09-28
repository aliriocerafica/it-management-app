import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { upsertLaptop } from "@/lib/inventory-repository"
import type { Laptop } from "@/lib/laptops"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const laptop = (await request.json()) as Laptop
  const saved = await upsertLaptop({ ...laptop, id })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/laptops")
  revalidatePath("/dashboard/analytics")
  return NextResponse.json(saved)
}
