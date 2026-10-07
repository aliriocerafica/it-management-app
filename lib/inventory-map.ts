import type { Accessory, AccessoryKind } from "@/lib/accessories"
import type {
  ChargerCondition,
  Laptop,
  LaptopStatus,
  OwnershipEntry,
} from "@/lib/laptops"
import type { Prisma } from "@/lib/generated/prisma"
import { legacyPlaceholderAddress } from "@/lib/anydesk"
import { decryptSecret } from "@/lib/crypto"

function decryptAnydeskAddress(
  value: string | null,
  assetTag: string,
): string | null {
  if (!value) return null
  let address = value
  try {
    address = decryptSecret(value)
  } catch {
    console.warn("Failed to decrypt anydeskAddress; returning raw stored value")
  }
  // Earlier versions filled empty addresses with a made-up number.
  return address === legacyPlaceholderAddress(assetTag) ? null : address
}

export type StatusCounts = Record<LaptopStatus, number> & { total: number }

export type InventorySummary = {
  laptops: StatusCounts
  headset: StatusCounts
  mouse: StatusCounts
  monitor: StatusCounts
  bag: StatusCounts
  battery: StatusCounts
  keyboard: StatusCounts
  ram: StatusCounts
}

export type VacantCounts = { laptops: number } & Record<AccessoryKind, number>

export const statusFromDb: Record<
  Prisma.LaptopGetPayload<object>["status"],
  LaptopStatus
> = {
  IN_USE: "In use",
  VACANT: "Vacant",
  IN_REPAIR: "In repair",
  RETIRED: "Retired",
}

export const statusToDb: Record<LaptopStatus, Prisma.LaptopGetPayload<object>["status"]> =
  {
    "In use": "IN_USE",
    Vacant: "VACANT",
    "In repair": "IN_REPAIR",
    Retired: "RETIRED",
  }

export const chargerFromDb = {
  GOOD: "Good",
  WORN_CABLE: "Worn cable",
  REPLACED: "Replaced",
  MISSING: "Missing",
} as const satisfies Record<string, ChargerCondition>

export const chargerToDb: Record<ChargerCondition, keyof typeof chargerFromDb> = {
  Good: "GOOD",
  "Worn cable": "WORN_CABLE",
  Replaced: "REPLACED",
  Missing: "MISSING",
}

export const kindFromDb = {
  HEADSET: "headset",
  MOUSE: "mouse",
  MONITOR: "monitor",
  BAG: "bag",
  BATTERY: "battery",
  KEYBOARD: "keyboard",
  RAM: "ram",
} as const satisfies Record<string, AccessoryKind>

export const kindToDb: Record<AccessoryKind, keyof typeof kindFromDb> = {
  headset: "HEADSET",
  mouse: "MOUSE",
  monitor: "MONITOR",
  bag: "BAG",
  battery: "BATTERY",
  keyboard: "KEYBOARD",
  ram: "RAM",
}

// Maps a handler name to their HRIS employee number (see employeeIdLookup).
export type EmployeeIdLookup = (name: string | null | undefined) => string | null

export function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function fromIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

type LaptopRecord = Prisma.LaptopGetPayload<{
  include: { charger: true; assignments: true }
}>

type AccessoryRecord = Prisma.AccessoryGetPayload<{
  include: { assignments: true }
}>

function toHistory(
  assignments: { handlerName: string | null; department: string | null; from: Date; to: Date | null; note: string | null }[],
): OwnershipEntry[] {
  return [...assignments]
    .sort((a, b) => a.from.getTime() - b.from.getTime())
    .map((entry) => ({
      handler: entry.handlerName,
      department: entry.department ?? undefined,
      from: toIsoDate(entry.from),
      to: entry.to ? toIsoDate(entry.to) : null,
      note: entry.note ?? undefined,
    }))
}

export function laptopFromDb(record: LaptopRecord): Laptop {
  if (!record.charger) {
    throw new Error(`Laptop ${record.assetTag} is missing a charger record`)
  }
  return {
    id: record.id,
    assetTag: record.assetTag,
    brand: record.brand,
    model: record.model,
    serialNumber: record.serialNumber,
    cpu: record.cpu,
    ram: record.ram,
    storage: record.storage,
    os: record.os,
    color: record.color,
    colorHex: record.colorHex,
    handler: record.handlerName,
    department: record.department,
    purchaseDate: toIsoDate(record.purchaseDate),
    warrantyYears: record.warrantyYears,
    status: statusFromDb[record.status],
    repairIssue: record.repairIssue,
    anydeskAddress: decryptAnydeskAddress(record.anydeskAddress, record.assetTag),
    charger: {
      connector: record.charger.connector,
      wattage: record.charger.wattage,
      partNumber: record.charger.partNumber,
      serialNumber: record.charger.serialNumber,
      condition: chargerFromDb[record.charger.condition],
    },
    history: toHistory(record.assignments),
  }
}

export function accessoryFromDb(record: AccessoryRecord): Accessory {
  return {
    id: record.id,
    kind: kindFromDb[record.kind],
    assetTag: record.assetTag,
    brand: record.brand,
    model: record.model,
    serialNumber: record.serialNumber,
    color: record.color,
    colorHex: record.colorHex,
    handler: record.handlerName,
    department: record.department,
    purchaseDate: toIsoDate(record.purchaseDate),
    warrantyYears: record.warrantyYears,
    status: statusFromDb[record.status],
    specs: (record.specs ?? {}) as Record<string, string>,
    repairIssue: record.repairIssue,
    laptopId: record.laptopId,
    history: toHistory(record.assignments),
  }
}

export function assignmentData(
  history: OwnershipEntry[],
  employeeIdFor: EmployeeIdLookup,
) {
  return history.map((entry) => ({
    employeeId: employeeIdFor(entry.handler),
    handlerName: entry.handler,
    department: entry.department ?? null,
    from: fromIsoDate(entry.from),
    to: entry.to ? fromIsoDate(entry.to) : null,
    note: entry.note ?? null,
  }))
}
