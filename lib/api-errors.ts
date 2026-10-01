import { NextResponse } from "next/server"

// Turns a failed inventory write into a response the dialogs can show.
// Unique-constraint violations (Prisma P2002) become a 409 naming the
// clashing field; anything else is logged and reported as a generic 500.
export function saveErrorResponse(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code
  if (code === "P2002") {
    // With driver adapters the clashing field can sit in different places in
    // `meta`, so search the whole thing.
    const meta = JSON.stringify((error as { meta?: unknown }).meta ?? {})
    const message = meta.includes("assetTag")
      ? "That asset tag is already used by another asset."
      : meta.includes("serialNumber")
        ? "That serial number is already used by another asset."
        : "Another asset already has these details."
    return NextResponse.json({ error: message }, { status: 409 })
  }

  console.error("Inventory save failed", error)
  return NextResponse.json(
    { error: "Couldn't save to the database. Please try again." },
    { status: 500 },
  )
}
