import { NextResponse } from "next/server"

import { getSignedCopy } from "@/lib/accountability-sign-link"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// The signed copy a holder uploaded for one form version.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const copy = await getSignedCopy(id)
  if (!copy) return NextResponse.json({ error: "No signed copy." }, { status: 404 })

  const filename = copy.fileName.replace(/["\\]/g, "")
  return new NextResponse(copy.stream, {
    headers: {
      "Content-Type": copy.contentType,
      "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      // It's someone else's upload: never let the browser guess its type.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  })
}
