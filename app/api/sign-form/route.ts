import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import {
  SIGNED_COPY_MAX_BYTES,
  findSignLink,
  saveSignedCopy,
  signedCopyType,
} from "@/lib/accountability-sign-link"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Public: the holder uploads their signed copy using the link from their
// email. The token in the form data is the only credential.
export async function POST(request: Request) {
  const body = await request.formData().catch(() => null)
  const token = body?.get("token")
  const file = body?.get("file")

  const link = typeof token === "string" ? await findSignLink(token) : null
  if (!link) {
    return NextResponse.json(
      { error: "This link is invalid or has expired. Ask IT to send a new one." },
      { status: 404 },
    )
  }
  if (link.form.signedAt) {
    return NextResponse.json(
      { error: "A signed copy of this form was already received." },
      { status: 409 },
    )
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 })
  }
  if (file.size > SIGNED_COPY_MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is too large. The limit is 4 MB." },
      { status: 413 },
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = signedCopyType(bytes)
  if (!type) {
    return NextResponse.json(
      { error: "Upload a PDF, JPG or PNG of the signed form." },
      { status: 415 },
    )
  }

  let saved: boolean
  try {
    saved = await saveSignedCopy(link, { bytes, ...type })
  } catch (error) {
    console.error("Storing a signed copy failed", error)
    return NextResponse.json(
      { error: "Couldn't save the file right now. Try again, or tell IT." },
      { status: 502 },
    )
  }
  if (!saved) {
    return NextResponse.json(
      { error: "A signed copy of this form was already received." },
      { status: 409 },
    )
  }
  revalidatePath("/dashboard/accountability")
  return NextResponse.json({ ok: true })
}
