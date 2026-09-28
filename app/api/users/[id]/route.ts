import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import { countActiveAdmins, updateUser } from "@/lib/user-repository"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const PatchUserSchema = z
  .object({
    isActive: z.boolean().optional(),
    role: z.enum(["ADMIN", "STAFF"]).optional(),
  })
  .refine((data) => data.isActive !== undefined || data.role !== undefined, {
    message: "Nothing to update.",
  })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await verifySession()
  if (!sessionUser) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  if (sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = PatchUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  const losingActiveAdminStatus =
    target.role === "ADMIN" &&
    (parsed.data.isActive === false || parsed.data.role === "STAFF")

  if (losingActiveAdminStatus) {
    const remainingAdmins = await countActiveAdmins(target.id)
    if (remainingAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot remove the last remaining admin." },
        { status: 400 },
      )
    }
  }

  const user = await updateUser(id, {
    isActive: parsed.data.isActive,
    role: parsed.data.role,
  })
  return NextResponse.json(user)
}
