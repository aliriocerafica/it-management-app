import { NextResponse } from "next/server"

import { resendLoginChallenge } from "@/lib/auth/login-otp"
import { EmailSendError } from "@/lib/email/brevo"

export const dynamic = "force-dynamic"

// Emails a new code for the sign-in this browser is part-way through.
export async function POST(request: Request) {
  const origin =
    process.env.APP_URL?.replace(/\/$/, "") || new URL(request.url).origin
  try {
    const result = await resendLoginChallenge(origin)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof EmailSendError
        ? error.message
        : "We couldn't send your sign-in code. Please try again."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
