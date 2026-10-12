import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { z } from "zod"

import {
  deleteFormVersion,
  listAccountabilityRows,
  setFormSigned,
} from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { signFormBackup } from "@/lib/form-backup-token"

export const dynamic = "force-dynamic"

const SignedSchema = z.object({ signed: z.boolean() })

// Marks one form version as physically signed, or as pending again.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const parsed = SignedSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const { id } = await params
  if (!(await setFormSigned(id, parsed.data.signed, user.name))) {
    return NextResponse.json({ error: "Form not found." }, { status: 404 })
  }
  revalidatePath("/dashboard/accountability")
  return NextResponse.json(await listAccountabilityRows())
}

// Deletes one form version and its send history; returns it for Undo.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const deleted = (await deleteFormVersion(id)).map(signFormBackup)
  revalidatePath("/dashboard/accountability")
  return NextResponse.json({ deleted })
}
