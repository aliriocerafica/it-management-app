import { NextResponse } from "next/server"
import { z } from "zod"

import {
  recordFormSend,
  renderFormPdf,
} from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { EmailSendError, sendEmail } from "@/lib/email/brevo"
import {
  accountabilityFormEmailHtml,
  accountabilityFormEmailText,
} from "@/lib/email/templates"
import { prisma } from "@/lib/prisma"

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
  const rendered = await renderFormPdf(id)
  if (!rendered) return NextResponse.json({ error: "Form not found." }, { status: 404 })
  const form = await prisma.accountabilityForm.findUnique({
    where: { id },
    select: { itOfficerName: true },
  })

  try {
    await sendEmail({
      to: parsed.data.to,
      subject: `Your IT accountability form (v${rendered.version})`,
      htmlContent: accountabilityFormEmailHtml(rendered.holderName, rendered.version, form!.itOfficerName),
      textContent: accountabilityFormEmailText(rendered.holderName, rendered.version, form!.itOfficerName),
      attachments: [{ name: rendered.filename, content: rendered.pdf.toString("base64") }],
    })
  } catch (error) {
    const status = error instanceof EmailSendError ? error.status : 502
    const message = error instanceof Error ? error.message : "Couldn't send the email."
    return NextResponse.json({ error: message }, { status })
  }

  await recordFormSend(id, parsed.data.to, user.name)
  return NextResponse.json({ ok: true })
}
