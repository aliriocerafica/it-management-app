import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { saveErrorResponse } from "@/lib/api-errors"
import { verifySession } from "@/lib/auth/session"
import { updateTicket } from "@/lib/ticket-repository"
import type { Ticket } from "@/lib/tickets"

export const dynamic = "force-dynamic"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const body = (await request.json()) as Ticket
  try {
    const saved = await updateTicket({ ...body, id })
    revalidatePath("/dashboard/tickets")
    return NextResponse.json(saved)
  } catch (error) {
    return saveErrorResponse(error)
  }
}
