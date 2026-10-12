import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import {
  getAccountabilityFormSettings,
  isSignatureDataUrl,
  saveAccountabilityFormSettings,
} from "@/lib/accountability-form-settings"

export const dynamic = "force-dynamic"

const Signatories = z
  .array(
    z.object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(254).nullable(),
      signature: z.string().refine(isSignatureDataUrl).nullable(),
    }),
  )
  .min(1)
  .max(20)

const UpdateSchema = z.object({
  hrName: z.string().trim().min(1),
  hrOfficers: Signatories,
  itOfficerName: z.string().trim().min(1),
  itOfficers: Signatories,
})

// What's wrong with one role's list, or null: everyone needs their own
// name, and the default has to be one of them.
function listProblem(
  label: string,
  people: z.infer<typeof Signatories>,
  defaultName: string,
) {
  const names = people.map((person) => person.name.toLowerCase())
  if (new Set(names).size !== names.length) {
    return `Each ${label} signatory needs a different name.`
  }
  if (!names.includes(defaultName.toLowerCase())) {
    return `Pick one of the ${label} signatories as the default.`
  }
  return null
}

export async function GET() {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }
  const settings = await getAccountabilityFormSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Enter a name for each IT and HR signatory. Check that any email addresses are valid and signatures are a small PNG or JPG.",
      },
      { status: 400 },
    )
  }

  const problem =
    listProblem("IT", parsed.data.itOfficers, parsed.data.itOfficerName) ??
    listProblem("HR", parsed.data.hrOfficers, parsed.data.hrName)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const settings = await saveAccountabilityFormSettings(parsed.data)
  return NextResponse.json(settings)
}
