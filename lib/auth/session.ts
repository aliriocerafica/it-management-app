import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { generateOpaqueToken, hashToken } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"
import type { SessionUser } from "@/lib/auth/dto"
import {
  SESSION_COOKIE_NAME,
  IDLE_TIMEOUT_MINUTES,
  ABSOLUTE_TIMEOUT_HOURS,
  REMEMBER_ME_DAYS,
} from "@/lib/auth/constants"

export { SESSION_COOKIE_NAME }

export async function createSession(
  userId: string,
  options: { rememberMe?: boolean; userAgent?: string | null } = {},
): Promise<void> {
  const token = generateOpaqueToken()
  const tokenHash = hashToken(token)
  const now = Date.now()
  const expiresAt = options.rememberMe
    ? new Date(now + REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000)
    : new Date(now + ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: options.userAgent ?? null,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

type SessionCheck =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "idle" }

// Cached per-request so repeated calls (layout + route handlers within the
// same render pass) only hit the database once.
export const checkSession = cache(async (): Promise<SessionCheck> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return { ok: false, reason: "invalid" }

  const tokenHash = hashToken(token)
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "invalid" }
  }

  if (!session.user.isActive) return { ok: false, reason: "invalid" }

  const idleLimitMs = IDLE_TIMEOUT_MINUTES * 60 * 1000
  if (Date.now() - session.lastActiveAt.getTime() > idleLimitMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    })
    return { ok: false, reason: "idle" }
  }

  // Sliding window: refresh activity without blocking the response.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastActiveAt: new Date() } })
    .catch(() => {})

  return {
    ok: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      avatarUrl: session.user.avatarUrl,
    },
  }
})

export const verifySession = cache(async (): Promise<SessionUser | null> => {
  const result = await checkSession()
  return result.ok ? result.user : null
})

/** For Server Components — sends the user to /login if there's no valid session. */
export async function requireSession(): Promise<SessionUser> {
  const result = await checkSession()
  if (result.ok) return result.user
  const reason = result.reason === "idle" ? "?reason=inactivity" : ""
  redirect(`/api/auth/session-expired${reason}`)
}

export async function currentSessionTokenHash(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  return token ? hashToken(token) : null
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/** Revokes every active session for a user, optionally sparing one (e.g. the caller's own). */
export async function destroyAllSessionsForUser(
  userId: string,
  exceptTokenHash?: string,
): Promise<void> {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptTokenHash ? { tokenHash: { not: exceptTokenHash } } : {}),
    },
    data: { revokedAt: new Date() },
  })
}
