import { NextResponse } from "next/server"
import { z } from "zod"

import { findSetupToken } from "@/lib/auth/setup-link"
import { hashPassword } from "@/lib/crypto"
import { passwordError } from "@/lib/password"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const INVALID_LINK = "This setup link is invalid or has expired. Ask IT to send a new one."

const SetupPasswordSchema = z.object({
  token: z.string().trim(),
  password: z.string(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = SetupPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 })
  }

  const strength = passwordError(parsed.data.password)
  if (strength) {
    return NextResponse.json({ error: strength }, { status: 400 })
  }

  const token = await findSetupToken(parsed.data.token)
  if (!token) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 })
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const now = new Date()
  // Claim the token first so a double submit can't use it twice.
  const claimed = await prisma.accountSetupToken.updateMany({
    where: { id: token.id, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 })
  }
  await prisma.user.update({
    where: { id: token.userId },
    data: {
      passwordHash,
      mustSetPassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  return NextResponse.json({ ok: true, email: token.user.email })
}
