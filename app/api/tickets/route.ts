import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { saveErrorResponse } from "@/lib/api-errors"
import { verifySession } from "@/lib/auth/session"
import {
  createTicket,
  deleteTickets,
  listTickets,
} from "@/lib/ticket-repository"
import type { Ticket } from "@/lib/tickets"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  return NextResponse.json(await listTickets())
}

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = (await request.json()) as Ticket
  if (!body.requesterName?.trim() || !body.subject?.trim() || !body.category?.trim()) {
    return NextResponse.json(
      { error: "Reported by, category and subject are required." },
      { status: 400 },
    )
  }
  try {
    const saved = await createTicket(body)
    revalidatePath("/dashboard/tickets")
    return NextResponse.json(saved)
  } catch (error) {
    return saveErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only an admin can permanently delete tickets." },
      { status: 403 },
    )
  }

  const { ids } = (await request.json()) as { ids: string[] }
  await deleteTickets(ids)
  revalidatePath("/dashboard/tickets")
  return NextResponse.json({ ok: true })
}
