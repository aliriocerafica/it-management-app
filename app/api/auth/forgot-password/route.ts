import { NextResponse } from "next/server"
import { z } from "zod"

import { generateNumericOtp, hashToken } from "@/lib/crypto"
import { sendEmail } from "@/lib/email/brevo"
import { otpEmailHtml } from "@/lib/email/templates"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

const OTP_EXPIRY_MINUTES = 10
const RESEND_COOLDOWN_MS = 60 * 1000
const GENERIC_OK = { ok: true }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = ForgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    // Still generic — don't reveal validation details tied to enumeration.
    return NextResponse.json(GENERIC_OK)
  }

  const email = parsed.data.email.toLowerCase()
  const user = await prisma.user.findUnique({ where: { email } })

  if (user && user.isActive) {
    const recent = await prisma.passwordResetOtp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    const withinCooldown =
      recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS

    if (!withinCooldown) {
      const code = generateNumericOtp()
      await prisma.passwordResetOtp.create({
        data: {
          userId: user.id,
          codeHash: hashToken(code),
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        },
      })

      await sendEmail({
        to: user.email,
        subject: "Your password reset code",
        htmlContent: otpEmailHtml(code),
      })
    }
  }

  // Always the same response, whether or not the email exists.
  return NextResponse.json(GENERIC_OK)
}
