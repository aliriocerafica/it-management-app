import { NextResponse } from "next/server"
import { z } from "zod"

import { trustDevice, verifyLoginChallenge } from "@/lib/auth/login-otp"
import { createSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VerifySchema = z.object({
  code: z.string().trim().min(6).max(8),
})

// Second step of signing in from a new device: the emailed code.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 })
  }

  const result = await verifyLoginChallenge(parsed.data.code)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { user, rememberMe } = result
  const userAgent = request.headers.get("user-agent")
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })
  await trustDevice(user.id, userAgent)
  await createSession(user.id, { rememberMe, userAgent })

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  })
}
