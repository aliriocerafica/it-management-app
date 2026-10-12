import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  return NextResponse.json({ user })
}

// A resized-to-thumbnail data: URL comes in well under this; anything near
// it means the client-side resize was skipped (or tampered with).
const MAX_AVATAR_LENGTH = 400_000

const UpdateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  avatarUrl: z
    .union([
      z.string().startsWith("data:image/").max(MAX_AVATAR_LENGTH),
      z.null(),
    ])
    .optional(),
})

export async function PATCH(request: Request) {
  const sessionUser = await verifySession()
  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  if (
    parsed.data.name === undefined &&
    parsed.data.avatarUrl === undefined
  ) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.avatarUrl !== undefined && {
        avatarUrl: parsed.data.avatarUrl,
      }),
    },
  })

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  })
}
