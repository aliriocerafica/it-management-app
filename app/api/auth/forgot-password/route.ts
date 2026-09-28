import { NextResponse } from "next/server"
import { z } from "zod"

import { generateNumericOtp, hashToken } from "@/lib/crypto"
import { EmailSendError, sendEmail } from "@/lib/email/brevo"
import { otpEmailHtml, otpEmailText } from "@/lib/email/templates"
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
    return NextResponse.json(GENERIC_OK)
  }

  const email = parsed.data.email.trim().toLowerCase()
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
      const otp = await prisma.passwordResetOtp.create({
        data: {
          userId: user.id,
          codeHash: hashToken(code),
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        },
      })

      const origin =
        process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin
      const copyUrl = `${origin}/copy-code?c=${encodeURIComponent(code)}`

      try {
        await sendEmail({
          to: user.email,
          subject: "Your reset code",
          htmlContent: otpEmailHtml(code, copyUrl),
          textContent: otpEmailText(code),
        })
      } catch (error) {
        await prisma.passwordResetOtp.delete({ where: { id: otp.id } }).catch(() => null)
        if (process.env.NODE_ENV !== "production") {
          console.log(`[otp] ${user.email} ${code}`)
        }
        const message =
          error instanceof EmailSendError
            ? error.message
            : "We couldn't send the reset email. Please try again."
        return NextResponse.json({ error: message }, { status: 502 })
      }
    }
  }

  return NextResponse.json(GENERIC_OK)
}
