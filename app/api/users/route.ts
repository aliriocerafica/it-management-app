import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import { createUser, listUsers } from "@/lib/user-repository"
import { sendEmail } from "@/lib/email/brevo"
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
  password: z.string(),
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

  const strength = passwordError(parsed.data.password)
  if (strength) {
    return NextResponse.json({ error: strength }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  })
  if (existing) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 })
  }

  const user = await createUser(parsed.data)
  const origin = new URL(request.url).origin
  const loginUrl = `${process.env.APP_URL?.replace(/\/$/, "") || origin}/login`
  try {
    await sendEmail({
      to: user.email,
      subject: "Your IT portal account is ready",
      htmlContent: accountCreatedEmailHtml(user.name, loginUrl),
      textContent: accountCreatedEmailText(user.name, loginUrl),
    })
  } catch (error) {
    console.error("[email:error] Welcome email failed", error)
  }
  return NextResponse.json(user, { status: 201 })
}
