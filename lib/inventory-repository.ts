import type { Accessory, AccessoryKind } from "@/lib/accessories"
import {
  accessoryFromDb,
  assignmentData,
  chargerToDb,
  fromIsoDate,
  type EmployeeIdLookup,
  kindToDb,
  laptopFromDb,
  statusFromDb,
  statusToDb,
} from "@/lib/inventory-map"
import { digitsOnly } from "@/lib/anydesk"
import { encryptSecret } from "@/lib/crypto"
import { employees } from "@/lib/employees"
import { fetchHrisEmployees } from "@/lib/hris"
import type { Laptop } from "@/lib/laptops"
import type { InventorySummary, StatusCounts } from "@/lib/inventory-map"
import { prisma } from "@/lib/prisma"
import type { RemoteAccessRow } from "@/lib/remote-access"

function emptyCounts(): StatusCounts {
  return {
    total: 0,
    "In use": 0,
    Vacant: 0,
    "In repair": 0,
    Retired: 0,
  }
}

function countsFromGroups(
  groups: { status: keyof typeof statusFromDb; _count: { _all: number } }[],
): StatusCounts {
  const counts = emptyCounts()
  for (const group of groups) {
    const status = statusFromDb[group.status]
    counts[status] = group._count._all
    counts.total += group._count._all
  }
  return counts
}

const laptopInclude = {
  charger: true,
  assignments: { orderBy: { from: "asc" as const } },
}

const accessoryInclude = {
  assignments: { orderBy: { from: "asc" as const } },
}

export async function listLaptops(): Promise<Laptop[]> {
  const rows = await prisma.laptop.findMany({
    include: laptopInclude,
    orderBy: { assetTag: "asc" },
  })
  return rows.map(laptopFromDb)
}

export async function listAccessories(kind: AccessoryKind): Promise<Accessory[]> {
  const rows = await prisma.accessory.findMany({
    where: { kind: kindToDb[kind] },
    include: accessoryInclude,
    orderBy: { assetTag: "asc" },
  })
  return rows.map(accessoryFromDb)
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const [laptopGroups, accessoryRows] = await Promise.all([
    prisma.laptop.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.accessory.groupBy({
      by: ["kind", "status"],
      _count: { _all: true },
    }),
  ])

  const accessories = {
    headset: emptyCounts(),
    mouse: emptyCounts(),
    monitor: emptyCounts(),
    bag: emptyCounts(),
    battery: emptyCounts(),
    keyboard: emptyCounts(),
  }

  for (const row of accessoryRows) {
    const kind = (
      {
        HEADSET: "headset",
        MOUSE: "mouse",
        MONITOR: "monitor",
        BAG: "bag",
        BATTERY: "battery",
        KEYBOARD: "keyboard",
      } as const
    )[row.kind]
    const status = statusFromDb[row.status]
    accessories[kind][status] = row._count._all
    accessories[kind].total += row._count._all
  }

  return {
    laptops: countsFromGroups(laptopGroups),
    ...accessories,
  }
}

// Handlers are stored by name; this links each name to its HRIS employee
// number. Separated employees are included so past holders still match. If
// HRIS is unreachable, falls back to the links already saved in this database.
async function employeeIdLookup(): Promise<EmployeeIdLookup> {
  const ids = new Map<string, string>()
  try {
    for (const employee of await fetchHrisEmployees("all")) {
      ids.set(employee.name.toLowerCase(), employee.id)
    }
  } catch (error) {
    console.warn("HRIS unavailable; using saved employee links", error)
    const where = { employeeId: { not: null }, handlerName: { not: null } }
    const select = { employeeId: true, handlerName: true }
    const rows = (
      await Promise.all([
        prisma.laptopAssignment.findMany({ where, select }),
        prisma.accessoryAssignment.findMany({ where, select }),
      ])
    ).flat()
    for (const row of rows) ids.set(row.handlerName!.toLowerCase(), row.employeeId!)
  }
  return (name) => (name ? (ids.get(name.trim().toLowerCase()) ?? null) : null)
}

export async function upsertLaptop(laptop: Laptop): Promise<Laptop> {
  const employeeIdFor = await employeeIdLookup()
  const employeeId = employeeIdFor(laptop.handler)
  const charger = {
    connector: laptop.charger.connector,
    wattage: laptop.charger.wattage,
    partNumber: laptop.charger.partNumber,
    serialNumber: laptop.charger.serialNumber,
    condition: chargerToDb[laptop.charger.condition],
  }
  const address = digitsOnly(laptop.anydeskAddress ?? "")
  const anydeskAddress = address ? encryptSecret(address) : null
  // Kept whatever the status: a laptop can be back in use with a repair
  // still pending.
  const repairIssue = laptop.repairIssue?.trim() || null

  const saved = await prisma.laptop.upsert({
    where: { id: laptop.id },
    create: {
      id: laptop.id,
      assetTag: laptop.assetTag,
      brand: laptop.brand,
      model: laptop.model,
      serialNumber: laptop.serialNumber,
      cpu: laptop.cpu,
      ram: laptop.ram,
      storage: laptop.storage,
      os: laptop.os,
      color: laptop.color,
      colorHex: laptop.colorHex,
      employeeId,
      handlerName: laptop.handler,
      department: laptop.department,
      purchaseDate: fromIsoDate(laptop.purchaseDate),
      warrantyYears: laptop.warrantyYears,
      status: statusToDb[laptop.status],
      repairIssue,
      anydeskAddress,
      charger: { create: charger },
      assignments: { create: assignmentData(laptop.history, employeeIdFor) },
    },
    update: {
      assetTag: laptop.assetTag,
      brand: laptop.brand,
      model: laptop.model,
      serialNumber: laptop.serialNumber,
      cpu: laptop.cpu,
      ram: laptop.ram,
      storage: laptop.storage,
      os: laptop.os,
      color: laptop.color,
      colorHex: laptop.colorHex,
      employeeId,
      handlerName: laptop.handler,
      department: laptop.department,
      purchaseDate: fromIsoDate(laptop.purchaseDate),
      warrantyYears: laptop.warrantyYears,
      status: statusToDb[laptop.status],
      repairIssue,
      anydeskAddress,
      charger: {
        upsert: {
          create: charger,
          update: charger,
        },
      },
      assignments: {
        deleteMany: {},
        create: assignmentData(laptop.history, employeeIdFor),
      },
    },
    include: laptopInclude,
  })

  return laptopFromDb(saved)
}

export async function upsertAccessory(item: Accessory): Promise<Accessory> {
  const employeeIdFor = await employeeIdLookup()
  const employeeId = employeeIdFor(item.handler)
  const saved = await prisma.accessory.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      kind: kindToDb[item.kind],
      assetTag: item.assetTag,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber,
      color: item.color,
      colorHex: item.colorHex,
      employeeId,
      handlerName: item.handler,
      department: item.department,
      purchaseDate: fromIsoDate(item.purchaseDate),
      warrantyYears: item.warrantyYears,
      status: statusToDb[item.status],
      specs: item.specs,
      repairIssue: item.repairIssue?.trim() || null,
      assignments: { create: assignmentData(item.history, employeeIdFor) },
    },
    update: {
      kind: kindToDb[item.kind],
      assetTag: item.assetTag,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber,
      color: item.color,
      colorHex: item.colorHex,
      employeeId,
      handlerName: item.handler,
      department: item.department,
      purchaseDate: fromIsoDate(item.purchaseDate),
      warrantyYears: item.warrantyYears,
      status: statusToDb[item.status],
      specs: item.specs,
      repairIssue: item.repairIssue?.trim() || null,
      assignments: {
        deleteMany: {},
        create: assignmentData(item.history, employeeIdFor),
      },
    },
    include: accessoryInclude,
  })

  return accessoryFromDb(saved)
}

export async function deleteLaptops(ids: string[]) {
  await prisma.laptop.deleteMany({ where: { id: { in: ids } } })
}

export async function deleteAccessories(ids: string[]) {
  await prisma.accessory.deleteMany({ where: { id: { in: ids } } })
}

export async function listRemoteAccessRows(): Promise<RemoteAccessRow[]> {
  const laptops = await listLaptops()
  const byName = new Map<string, RemoteAccessRow>()

  // One row per person. Several laptops can share a handler, and each keeps
  // its own AnyDesk address on that row.
  for (const laptop of laptops) {
    if (!laptop.handler) continue
    const name = laptop.handler
    const key = name.toLowerCase()
    const existing = byName.get(key)
    if (existing) {
      existing.laptops.push(laptop)
      continue
    }
    const known = employees.find((employee) => employee.name.toLowerCase() === key)
    byName.set(key, {
      employee: known ?? {
        id: `handler:${name}`,
        name,
        department: laptop.department ?? "",
        title: "",
        email: "",
      },
      laptops: [laptop],
    })
  }

  for (const employee of employees) {
    const key = employee.name.toLowerCase()
    if (!byName.has(key)) byName.set(key, { employee, laptops: [] })
  }

  return [...byName.values()].sort((a, b) =>
    a.employee.name.localeCompare(b.employee.name),
  )
}

export async function getLaptopById(id: string): Promise<Laptop | null> {
  const row = await prisma.laptop.findUnique({
    where: { id },
    include: laptopInclude,
  })
  return row ? laptopFromDb(row) : null
}

// Everything currently checked out to one person, for the accountability form.
export async function listAssignedAssets(
  employeeName: string,
): Promise<{ laptops: Laptop[]; accessories: Accessory[] }> {
  const [laptopRows, accessoryRows] = await Promise.all([
    prisma.laptop.findMany({ where: { handlerName: employeeName }, include: laptopInclude }),
    prisma.accessory.findMany({ where: { handlerName: employeeName }, include: accessoryInclude }),
  ])
  return {
    laptops: laptopRows.map(laptopFromDb),
    accessories: accessoryRows.map(accessoryFromDb),
  }
}
