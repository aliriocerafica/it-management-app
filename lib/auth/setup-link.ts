import { generateOpaqueToken, hashToken } from "@/lib/crypto"
import { sendEmail } from "@/lib/email/brevo"
import { setupLinkEmailHtml, setupLinkEmailText } from "@/lib/email/templates"
import { prisma } from "@/lib/prisma"

export const SETUP_LINK_TTL_HOURS = 72

export function appBaseUrl(request: Request) {
  return process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin
}

// Issues a fresh link (any earlier unused ones stop working) and emails it.
// Throws EmailSendError if the email can't be sent.
export async function sendSetupLink(
  user: { id: string; name: string; email: string },
  baseUrl: string,
) {
  const token = generateOpaqueToken()
  const now = new Date()
  await prisma.$transaction([
    prisma.accountSetupToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now },
    }),
    prisma.accountSetupToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + SETUP_LINK_TTL_HOURS * 3_600_000),
      },
    }),
  ])

  const url = `${baseUrl}/setup-password?token=${token}`
  await sendEmail({
    to: user.email,
    subject: "Set up your IT Management account",
    htmlContent: setupLinkEmailHtml(user.name, url, SETUP_LINK_TTL_HOURS),
    textContent: setupLinkEmailText(user.name, url, SETUP_LINK_TTL_HOURS),
  })
}

// The unused, unexpired token for this raw value, with its (active) user.
export async function findSetupToken(rawToken: string) {
  if (!/^[0-9a-f]{64}$/.test(rawToken)) return null
  const token = await prisma.accountSetupToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  })
  if (
    !token ||
    token.consumedAt ||
    token.expiresAt <= new Date() ||
    !token.user.isActive
  ) {
    return null
  }
  return token
}
