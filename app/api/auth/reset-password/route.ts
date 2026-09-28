import { NextResponse } from "next/server"
import { z } from "zod"

import { verifyResetOtp } from "@/lib/auth/reset-otp"
import { hashPassword } from "@/lib/crypto"
import { destroyAllSessionsForUser } from "@/lib/auth/session"
import { passwordError } from "@/lib/password"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(6).max(8),
  newPassword: z.string().min(8),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = ResetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 })
  }

  const strength = passwordError(parsed.data.newPassword)
  if (strength) {
    return NextResponse.json({ error: strength }, { status: 400 })
  }

  const result = await verifyResetOtp(parsed.data.email, parsed.data.code)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: result.user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetOtp.update({
      where: { id: result.otp.id },
      data: { consumedAt: new Date() },
    }),
  ])

  await destroyAllSessionsForUser(result.user.id)

  return NextResponse.json({ ok: true })
}
