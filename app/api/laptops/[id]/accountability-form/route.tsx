import { NextResponse } from "next/server"

import { getAccountabilityFormSettings } from "@/lib/accountability-form-settings"
import { accessoryConfigs } from "@/lib/accessories"
import { verifySession } from "@/lib/auth/session"
import { getLaptopById, listAssignedAssets } from "@/lib/inventory-repository"
import { formatDate } from "@/lib/laptops"
import {
  fillAccountabilityForm,
  type EquipmentRow,
} from "@/lib/pdf/fill-accountability-form"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function queryName(value: string | null) {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return ""
  return trimmed
}

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

  const { laptops, accessories } = await listAssignedAssets(laptop.handler)

  const equipment: EquipmentRow[] = []
  for (const l of laptops) {
    equipment.push({
      item: "Laptop",
      brand: l.brand,
      model: l.model,
      serialNumber: l.serialNumber,
      unitCount: 1,
    })
    equipment.push({
      item: "Laptop Charger",
      brand: l.brand,
      model: l.charger.partNumber,
      serialNumber: l.charger.serialNumber,
      unitCount: 1,
    })
  }
  for (const item of accessories) {
    equipment.push({
      item: accessoryConfigs[item.kind].singular,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber,
      unitCount: 1,
    })
  }

  const buffer = await fillAccountabilityForm({
    employeeName: laptop.handler,
    itOfficerName,
    hrName,
    generatedOn: formatDate(new Date()),
    equipment,
  })

  const filename = `Accountability Form - ${laptop.handler}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  })
}
