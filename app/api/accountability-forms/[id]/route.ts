import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { deleteFormVersion } from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { signFormBackup } from "@/lib/form-backup-token"

export const dynamic = "force-dynamic"

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
