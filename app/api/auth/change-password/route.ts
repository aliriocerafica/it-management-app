import { NextResponse } from "next/server"
import { z } from "zod"

import { hashPassword, verifyPassword } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"
import {
  currentSessionTokenHash,
  destroyAllSessionsForUser,
  verifySession,
} from "@/lib/auth/session"
import { passwordError } from "@/lib/password"

export const dynamic = "force-dynamic"

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(request: Request) {
  const sessionUser = await verifySession()
  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const strength = passwordError(parsed.data.newPassword)
  if (strength) {
    return NextResponse.json({ error: strength }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } })
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 })
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  })

  const exceptTokenHash = (await currentSessionTokenHash()) ?? undefined
  await destroyAllSessionsForUser(user.id, exceptTokenHash)

  return NextResponse.json({ ok: true })
}
