import { NextResponse } from "next/server"

import { renderFormPdf } from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Renders a saved form version. ?download=1 saves it instead of opening it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { id } = await params
  const rendered = await renderFormPdf(id)
  if (!rendered) return NextResponse.json({ error: "Form not found." }, { status: 404 })

  const download = new URL(request.url).searchParams.get("download") === "1"
  const filename = rendered.filename.replace(/["\\]/g, "")
  return new NextResponse(new Uint8Array(rendered.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
