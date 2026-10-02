import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import type { FormBackup } from "@/lib/accountability-forms"
import {
  listAccountabilityRows,
  restoreForms,
} from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { isSignedFormBackup } from "@/lib/form-backup-token"

export const dynamic = "force-dynamic"

// Undo for deleted form versions: puts them back as they were.
export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { forms?: FormBackup[] } | null
  if (!Array.isArray(body?.forms) || body.forms.length === 0) {
    return NextResponse.json({ error: "Nothing to restore." }, { status: 400 })
  }
  if (!body.forms.every((form) => isSignedFormBackup(form as FormBackup))) {
    return NextResponse.json(
      { error: "These forms can't be restored." },
      { status: 400 },
    )
  }
  try {
    await restoreForms(body.forms)
  } catch (error) {
    console.error("Restoring accountability forms failed", error)
    return NextResponse.json({ error: "Couldn't restore the forms." }, { status: 500 })
  }
  revalidatePath("/dashboard/accountability")
  return NextResponse.json(await listAccountabilityRows())
}
