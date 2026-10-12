import { NextResponse } from "next/server"
import { z } from "zod"

import { appBaseUrl, sendSetupLink } from "@/lib/auth/setup-link"
import { verifySession } from "@/lib/auth/session"
import { createUser, listUsers } from "@/lib/user-repository"
import { EmailSendError, sendEmail } from "@/lib/email/brevo"
import {
  accountCreatedEmailHtml,
  accountCreatedEmailText,
} from "@/lib/email/templates"
import { passwordError } from "@/lib/password"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const CreateUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  // Omit to invite the user: they get an emailed link to choose their own.
  password: z.string().optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
})

async function requireAdmin() {
  const user = await verifySession()
  if (!user) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) }
  if (user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  }
  return { user }
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const users = await listUsers()
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const { password } = parsed.data
  if (password !== undefined) {
    const strength = passwordError(password)
    if (strength) {
      return NextResponse.json({ error: strength }, { status: 400 })
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  })
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 })
  }

  const user = await createUser(parsed.data)
  const baseUrl = appBaseUrl(request)

  if (password === undefined) {
    // The account exists either way; a failed email can be resent from the table.
    let emailError: string | null = null
    try {
      await sendSetupLink(user, baseUrl)
    } catch (error) {
      console.error("[email:error] Setup link email failed", error)
      emailError =
        error instanceof EmailSendError ? error.message : "The setup link email could not be sent."
    }
    return NextResponse.json({ ...user, emailError }, { status: 201 })
  }

  const loginUrl = `${baseUrl}/login`
  try {
    await sendEmail({
      to: user.email,
      subject: "Your IT Management account is ready",
      htmlContent: accountCreatedEmailHtml(user.name, loginUrl),
      textContent: accountCreatedEmailText(user.name, loginUrl),
    })
  } catch (error) {
    console.error("[email:error] Welcome email failed", error)
  }
  return NextResponse.json(user, { status: 201 })
}
