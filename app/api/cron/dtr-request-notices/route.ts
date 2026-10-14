import { NextResponse } from "next/server"

import { notifyNewDtrAssetRequests } from "@/lib/asset-request-notify"

export const dynamic = "force-dynamic"

// Scheduled by vercel.json. Vercel sends `Authorization: Bearer CRON_SECRET`
// on cron-triggered calls; if CRON_SECRET isn't set (local dev), the check
// is skipped so this can be hit manually while testing.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const result = await notifyNewDtrAssetRequests()
  return NextResponse.json(result)
}
