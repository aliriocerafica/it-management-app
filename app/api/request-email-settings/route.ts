import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import {
  REQUEST_EMAIL_MAX_RECIPIENTS,
  getRequestEmailSettings,
  saveRequestEmailSettings,
} from "@/lib/request-email-settings"

export const dynamic = "force-dynamic"

const Email = z.string().trim().toLowerCase().email().max(254)

const UpdateSchema = z.object({
  appUsers: z
    .array(
      z.object({
        id: z.string().min(1),
        email: Email.nullable(),
        copied: z.boolean(),
      }),
    )
    .max(200),
  extraRecipients: z.array(Email).max(REQUEST_EMAIL_MAX_RECIPIENTS),
})

export async function GET() {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  return NextResponse.json(await getRequestEmailSettings())
}

export async function PUT(request: Request) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Check that every address is a valid email. You can add up to ${REQUEST_EMAIL_MAX_RECIPIENTS}.`,
      },
      { status: 400 },
    )
  }

  return NextResponse.json(await saveRequestEmailSettings(parsed.data))
}
