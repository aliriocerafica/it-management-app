import { NextResponse } from "next/server"

import { renderFormPdf } from "@/lib/accountability-repository"
import { findSignLink } from "@/lib/accountability-sign-link"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Public: the form a sign link is for, so its holder can print it again.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")
  const link = token ? await findSignLink(token) : null
  const rendered = link ? await renderFormPdf(link.form.id) : null
  if (!rendered) {
    return NextResponse.json({ error: "Link invalid or expired." }, { status: 404 })
  }

  const filename = rendered.filename.replace(/["\\]/g, "")
  return new NextResponse(new Uint8Array(rendered.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
