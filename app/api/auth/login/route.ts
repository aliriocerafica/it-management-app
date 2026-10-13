import { NextResponse } from "next/server"
import { z } from "zod"

import { verifyPassword } from "@/lib/crypto"
import { isTrustedDevice, startLoginChallenge } from "@/lib/auth/login-otp"
import { createSession } from "@/lib/auth/session"
import { EmailSendError } from "@/lib/email/brevo"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
})

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const GENERIC_ERROR = { error: "Invalid email or password." }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 })
  }

  const { email, password, rememberMe } = parsed.data
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user || !user.isActive) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 })
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return NextResponse.json(GENERIC_ERROR, { status: 401 })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const failedLoginAttempts = user.failedLoginAttempts + 1
    const lockedUntil =
      failedLoginAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts, lockedUntil },
    })
    return NextResponse.json(GENERIC_ERROR, { status: 401 })
  }

  // A browser that hasn't signed in to this account before also has to
  // enter a code sent to the account's email.
  if (!(await isTrustedDevice(user.id))) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
    try {
      await startLoginChallenge(user, {
        rememberMe,
        origin:
          process.env.APP_URL?.replace(/\/$/, "") ||
          new URL(request.url).origin,
      })
    } catch (error) {
      const message =
        error instanceof EmailSendError
          ? error.message
          : "We couldn't send your sign-in code. Please try again."
      return NextResponse.json({ error: message }, { status: 502 })
    }
    return NextResponse.json({ otpRequired: true })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  await createSession(user.id, {
    rememberMe,
    userAgent: request.headers.get("user-agent"),
  })

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
}
