import { NextResponse } from "next/server"
import { z } from "zod"

import { emailForm } from "@/lib/accountability-email"
import { verifySession } from "@/lib/auth/session"
import { EmailSendError } from "@/lib/email/brevo"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SendSchema = z.object({ to: z.string().trim().email() })

// Emails the employee a copy of one form version, with the PDF attached.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const parsed = SendSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  const { id } = await params
  let sent: { cc: string[] } | null
  try {
    sent = await emailForm(request, id, parsed.data.to, user.name)
  } catch (error) {
    const status = error instanceof EmailSendError ? error.status : 502
    const message = error instanceof Error ? error.message : "Couldn't send the email."
    return NextResponse.json({ error: message }, { status })
  }
  if (!sent) return NextResponse.json({ error: "Form not found." }, { status: 404 })
  return NextResponse.json({ ok: true, cc: sent.cc })
}
