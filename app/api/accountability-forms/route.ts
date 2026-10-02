import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  deleteFormsFor,
  generateForm,
  listAccountabilityRows,
} from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { signFormBackup } from "@/lib/form-backup-token"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  return NextResponse.json(await listAccountabilityRows())
}

const GenerateSchema = z.object({
  holders: z.array(z.string().trim().min(1)).min(1),
  hrName: z.string().trim().min(1),
  itOfficerName: z.string().trim().min(1),
  // Save a new version even when nothing on the form changed.
  force: z.boolean().optional(),
})

// Generates (or reuses) a form for each holder, then returns the refreshed table.
export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const parsed = GenerateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Choose who to generate for and enter the HR and IT Officer names." },
      { status: 400 },
    )
  }
  const { holders, hrName, itOfficerName, force } = parsed.data
  try {
    for (const holder of holders) {
      await generateForm(holder, { hrName, itOfficerName }, user.name, force)
    }
  } catch (error) {
    console.error("Accountability form generation failed", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't generate the form." },
      { status: 500 },
    )
  }
  revalidatePath("/dashboard/accountability")
  return NextResponse.json(await listAccountabilityRows())
}

const DeleteSchema = z.object({ holders: z.array(z.string().trim().min(1)).min(1) })

// Deletes all form versions for these holders. Returns the refreshed table
// and the deleted versions, which the Undo toast posts back to /restore.
export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const parsed = DeleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose whose forms to delete." }, { status: 400 })
  }
  const deleted = (await deleteFormsFor(parsed.data.holders)).map(signFormBackup)
  revalidatePath("/dashboard/accountability")
  return NextResponse.json({ rows: await listAccountabilityRows(), deleted })
}
