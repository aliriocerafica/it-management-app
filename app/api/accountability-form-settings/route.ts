import { NextResponse } from "next/server"
import { z } from "zod"

import { verifySession } from "@/lib/auth/session"
import {
  getAccountabilityFormSettings,
  saveAccountabilityFormSettings,
} from "@/lib/accountability-form-settings"

export const dynamic = "force-dynamic"

const UpdateSchema = z.object({
  hrName: z.string().trim().min(1),
  itOfficerName: z.string().trim().min(1),
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
    return NextResponse.json({ error: "Enter both the HR and IT Officer names." }, { status: 400 })
  }

  const settings = await saveAccountabilityFormSettings(parsed.data)
  return NextResponse.json(settings)
}
