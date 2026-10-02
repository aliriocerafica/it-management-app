import { NextResponse } from "next/server"

import { getAccountabilityFormSettings } from "@/lib/accountability-form-settings"
import { generateForm, renderFormPdf } from "@/lib/accountability-repository"
import { verifySession } from "@/lib/auth/session"
import { getLaptopById } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function queryName(value: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return ""
  return trimmed
}

// Generates the handler's form (saved as a version on the Accountability
// page; reused if nothing changed) and opens it.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const { id } = await params
  const laptop = await getLaptopById(id)
  if (!laptop) {
    return NextResponse.json({ error: "Laptop not found." }, { status: 404 })
  }
  if (!laptop.handler) {
    return NextResponse.json(
      { error: "This laptop isn't currently assigned to anyone." },
      { status: 400 },
    )
  }

  const settings = await getAccountabilityFormSettings()
  const search = new URL(request.url).searchParams
  const hrName = queryName(search.get("hr")) || settings.hrName
  const itOfficerName =
    queryName(search.get("it")) || settings.itOfficerName || user.name

  const form = await generateForm(laptop.handler, { hrName, itOfficerName }, user.name)
  const rendered = (await renderFormPdf(form.id))!
  const filename = rendered.filename.replace(/["\\]/g, "")

  return new NextResponse(new Uint8Array(rendered.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
