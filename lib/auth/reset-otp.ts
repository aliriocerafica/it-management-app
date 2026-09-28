import { hashToken } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

export const MAX_OTP_ATTEMPTS = 5
export const GENERIC_OTP_ERROR = "Invalid or expired code."

export async function verifyResetOtp(email: string, rawCode: string) {
  const code = rawCode.replace(/\D/g, "")
  if (code.length !== 6) {
    return { ok: false as const, error: GENERIC_OTP_ERROR }
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  })
  if (!user) {
    return { ok: false as const, error: GENERIC_OTP_ERROR }
  }

  const otp = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  if (!otp || otp.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false as const, error: GENERIC_OTP_ERROR }
  }

  if (otp.codeHash !== hashToken(code)) {
    await prisma.passwordResetOtp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false as const, error: GENERIC_OTP_ERROR }
  }

  return { ok: true as const, user, otp, code }
}
