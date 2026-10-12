import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import {
  getAccountabilityFormSettings,
  isSignatureDataUrl,
  saveAccountabilityFormSettings,
} from "@/lib/accountability-form-settings"

export const dynamic = "force-dynamic"

const Email = z.string().trim().toLowerCase().email().max(254).nullable()

const UpdateSchema = z.object({
  hrName: z.string().trim().min(1),
  hrEmail: Email,
  hrSignature: z.string().refine(isSignatureDataUrl).nullable(),
  itOfficerName: z.string().trim().min(1),
  itOfficers: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        name: z.string().trim().min(1).max(120),
        email: Email,
        signature: z.string().refine(isSignatureDataUrl).nullable(),
      }),
    )
    .min(1)
    .max(20),
})

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
          "Enter the HR name and a name for each IT officer. Check that any email addresses are valid and signatures are a small PNG or JPG.",
      },
      { status: 400 },
    )
  }

  const names = parsed.data.itOfficers.map((officer) => officer.name.toLowerCase())
  if (new Set(names).size !== names.length) {
    return NextResponse.json(
      { error: "Each IT officer needs a different name." },
      { status: 400 },
    )
  }
  if (!names.includes(parsed.data.itOfficerName.toLowerCase())) {
    return NextResponse.json(
      { error: "Pick one of the IT officers as the default signatory." },
      { status: 400 },
    )
  }

  const settings = await saveAccountabilityFormSettings(parsed.data)
  return NextResponse.json(settings)
}
