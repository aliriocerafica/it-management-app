import { NextResponse } from "next/server"
import { z } from "zod"

import { verifyResetOtp } from "@/lib/auth/reset-otp"

export const dynamic = "force-dynamic"

const VerifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(6).max(8),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = VerifyOtpSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 })
  }

  const result = await verifyResetOtp(parsed.data.email, parsed.data.code)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
