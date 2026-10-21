import { NextResponse } from "next/server"
import { z } from "zod"

import { emailForm } from "@/lib/accountability-email"
import { getAccountabilityFormSettings } from "@/lib/accountability-form-settings"
import {
  generateSaleForm,
  getFormVersion,
} from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { EmailSendError } from "@/lib/email/brevo"
import { getLaptopById } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SaleFormSchema = z.object({
  buyer: z.string().trim().min(1),
  to: z.string().trim().email(),
})

// Generates the buyer's accountability form for a sold laptop and emails it
// to them with the link for uploading the signed copy.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const parsed = SaleFormSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the buyer's name and a valid email address." },
      { status: 400 },
    )
  }

  const { id } = await params
  const laptop = await getLaptopById(id)
  if (!laptop) return NextResponse.json({ error: "Laptop not found." }, { status: 404 })

  const settings = await getAccountabilityFormSettings()
  const form = await generateSaleForm(
    laptop,
    parsed.data.buyer,
    {
      hrName: settings.hrName,
      itOfficerName: settings.itOfficerName || settings.itOfficers[0]?.name || user.name,
    },
    user.name,
  )

  try {
    await emailForm(request, form.id, parsed.data.to, user.name)
  } catch (error) {
    const status = error instanceof EmailSendError ? error.status : 502
    const message = error instanceof Error ? error.message : "Couldn't send the email."
    return NextResponse.json({ error: message }, { status })
  }
  return NextResponse.json(await getFormVersion(form.id))
}
