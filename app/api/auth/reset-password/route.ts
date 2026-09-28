import { NextResponse } from "next/server"
import { z } from "zod"

import { hashPassword, hashToken } from "@/lib/crypto"
import { destroyAllSessionsForUser } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8),
})

const MAX_ATTEMPTS = 5
const GENERIC_ERROR = { error: "Invalid or expired code." }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = ResetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  const { email, code, newPassword } = parsed.data
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) {
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  const otp = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  if (!otp || otp.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  if (otp.codeHash !== hashToken(code)) {
    await prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    return NextResponse.json(GENERIC_ERROR, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
  ])

  await destroyAllSessionsForUser(user.id)

  return NextResponse.json({ ok: true })
}
