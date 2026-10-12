import { NextResponse } from "next/server"

import { appBaseUrl, sendSetupLink } from "@/lib/auth/setup-link"
import { verifySession } from "@/lib/auth/session"
import { EmailSendError } from "@/lib/email/brevo"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await verifySession()
  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }
  if (!user.mustSetPassword) {
    return NextResponse.json(
      { error: "This user has already set a password. Send a password reset instead." },
      { status: 400 },
    )
  }
  if (!user.isActive) {
    return NextResponse.json(
      { error: "Reactivate this user before sending a setup link." },
      { status: 400 },
    )
  }

  try {
    await sendSetupLink(user, appBaseUrl(request))
  } catch (error) {
    console.error("[email:error] Setup link email failed", error)
    const message =
      error instanceof EmailSendError ? error.message : "The setup link email could not be sent."
    return NextResponse.json({ error: message }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
