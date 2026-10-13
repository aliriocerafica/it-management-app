import { cookies } from "next/headers"

import {
  DEVICE_COOKIE_NAME,
  LOGIN_CHALLENGE_COOKIE_NAME,
  TRUSTED_DEVICE_DAYS,
} from "@/lib/auth/constants"
import { generateNumericOtp, generateOpaqueToken, hashToken } from "@/lib/crypto"
import { sendEmail } from "@/lib/email/brevo"
import {
  loginOtpWording,
  otpEmailHtml,
  otpEmailText,
} from "@/lib/email/templates"
import { prisma } from "@/lib/prisma"

// Signing in from a browser that hasn't been used for the account before
// takes a code sent to the account's email, on top of the password.

const OTP_EXPIRY_MINUTES = 10
const RESEND_COOLDOWN_MS = 60 * 1000
const MAX_OTP_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const GENERIC_OTP_ERROR = "Invalid or expired code."
const EXPIRED_ERROR = "This sign-in has expired. Enter your password again."

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}

type CodeRecipient = { id: string; email: string }

async function deviceTokenHash() {
  const token = (await cookies()).get(DEVICE_COOKIE_NAME)?.value
  return token ? hashToken(token) : null
}

// Whether this browser has already passed the emailed code for the user.
export async function isTrustedDevice(userId: string): Promise<boolean> {
  const tokenHash = await deviceTokenHash()
  if (!tokenHash) return false
  const device = await prisma.trustedDevice.findUnique({
    where: { userId_tokenHash: { userId, tokenHash } },
  })
  if (!device || device.expiresAt.getTime() < Date.now()) return false
  await prisma.trustedDevice.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  })
  return true
}

// Remembers this browser for the user, so the next sign-in skips the code.
export async function trustDevice(userId: string, userAgent: string | null) {
  const cookieStore = await cookies()
  // One token per browser, shared by every account that signs in on it.
  const token =
    cookieStore.get(DEVICE_COOKIE_NAME)?.value ?? generateOpaqueToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(
    Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000,
  )
  await prisma.trustedDevice.upsert({
    where: { userId_tokenHash: { userId, tokenHash } },
    create: { userId, tokenHash, userAgent, expiresAt },
    update: { userAgent, expiresAt, lastUsedAt: new Date() },
  })
  cookieStore.set(DEVICE_COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt,
  })
}

async function sendLoginCode(user: CodeRecipient, code: string, origin: string) {
  const copyUrl = `${origin}/copy-code?c=${encodeURIComponent(code)}`
  try {
    await sendEmail({
      to: user.email,
      subject: "Your sign-in code",
      htmlContent: otpEmailHtml(code, copyUrl, loginOtpWording),
      textContent: otpEmailText(code, loginOtpWording),
    })
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[login otp] ${user.email} ${code}`)
    }
    throw error
  }
}

// Emails a code and ties it to this browser. Throws if the email can't be
// sent; nothing is left behind in that case.
export async function startLoginChallenge(
  user: CodeRecipient,
  options: { rememberMe?: boolean; origin: string },
) {
  const token = generateOpaqueToken()
  const tokenHash = hashToken(token)
  const rememberMe = Boolean(options.rememberMe)

  // A code emailed moments ago is still good: signing in again within the
  // cooldown reuses it rather than sending another email.
  const recent = await prisma.loginOtp.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_OTP_ATTEMPTS },
      sentAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { sentAt: "desc" },
  })

  let expiresAt: Date
  if (recent) {
    expiresAt = recent.expiresAt
    await prisma.loginOtp.update({
      where: { id: recent.id },
      data: { tokenHash, rememberMe },
    })
  } else {
    const code = generateNumericOtp()
    expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
    const otp = await prisma.loginOtp.create({
      data: {
        userId: user.id,
        tokenHash,
        codeHash: hashToken(code),
        rememberMe,
        expiresAt,
      },
    })
    try {
      await sendLoginCode(user, code, options.origin)
    } catch (error) {
      await prisma.loginOtp.delete({ where: { id: otp.id } }).catch(() => null)
      throw error
    }
  }

  ;(await cookies()).set(LOGIN_CHALLENGE_COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt,
  })
}

// The sign-in this browser is part-way through, if it's still usable.
async function currentChallenge() {
  const token = (await cookies()).get(LOGIN_CHALLENGE_COOKIE_NAME)?.value
  if (!token) return null
  const otp = await prisma.loginOtp.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (
    !otp ||
    otp.consumedAt ||
    otp.expiresAt.getTime() < Date.now() ||
    otp.attempts >= MAX_OTP_ATTEMPTS ||
    !otp.user.isActive
  ) {
    return null
  }
  return otp
}

export async function verifyLoginChallenge(rawCode: string) {
  const code = rawCode.replace(/\D/g, "")
  const otp = await currentChallenge()
  if (!otp) return { ok: false as const, error: EXPIRED_ERROR }
  if (code.length !== 6) return { ok: false as const, error: GENERIC_OTP_ERROR }

  if (otp.codeHash !== hashToken(code)) {
    const attempts = otp.attempts + 1
    await prisma.loginOtp.update({
      where: { id: otp.id },
      data: { attempts },
    })
    if (attempts < MAX_OTP_ATTEMPTS) {
      return { ok: false as const, error: GENERIC_OTP_ERROR }
    }
    // Out of tries: whoever this is has the password, so lock the account
    // for a while rather than let them start over with a fresh code.
    await prisma.user.update({
      where: { id: otp.userId },
      data: {
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
      },
    })
    ;(await cookies()).delete(LOGIN_CHALLENGE_COOKIE_NAME)
    return {
      ok: false as const,
      error: `Too many wrong codes. Try signing in again in ${LOCKOUT_MINUTES} minutes.`,
    }
  }

  await prisma.loginOtp.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  })
  ;(await cookies()).delete(LOGIN_CHALLENGE_COOKIE_NAME)
  return { ok: true as const, user: otp.user, rememberMe: otp.rememberMe }
}

// Emails a fresh code for the sign-in in progress. Throws if the email
// can't be sent.
export async function resendLoginChallenge(origin: string) {
  const otp = await currentChallenge()
  if (!otp) return { ok: false as const, error: EXPIRED_ERROR }

  const waitMs = otp.sentAt.getTime() + RESEND_COOLDOWN_MS - Date.now()
  if (waitMs > 0) {
    return {
      ok: false as const,
      error: `Wait ${Math.ceil(waitMs / 1000)} seconds before asking for another code.`,
    }
  }

  const code = generateNumericOtp()
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
  await sendLoginCode(otp.user, code, origin)
  await prisma.loginOtp.update({
    where: { id: otp.id },
    data: { codeHash: hashToken(code), expiresAt, sentAt: new Date() },
  })
  const cookieStore = await cookies()
  const token = cookieStore.get(LOGIN_CHALLENGE_COOKIE_NAME)!.value
  cookieStore.set(LOGIN_CHALLENGE_COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt,
  })
  return { ok: true as const }
}

// Makes every browser enter a code again, e.g. after a password reset.
export async function forgetTrustedDevices(userId: string) {
  await prisma.trustedDevice.deleteMany({ where: { userId } })
}
