import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

import { verifySession } from "@/lib/auth/session"
import { fetchHrisEmployees } from "@/lib/hris"

export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  try {
    return NextResponse.json(await fetchHrisEmployees())
  } catch (error) {
    console.error("Failed to load HRIS employees", error)
    return NextResponse.json(
      { error: "Couldn't reach the HRIS employee directory." },
      { status: 502 },
    )
  }
}
