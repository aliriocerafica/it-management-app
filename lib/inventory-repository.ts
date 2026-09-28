import type { Accessory, AccessoryKind } from "@/lib/accessories"
import {
  accessoryFromDb,
  assignmentData,
  chargerToDb,
  employeeIdFor,
  fromIsoDate,
  kindToDb,
  laptopFromDb,
  statusFromDb,
  statusToDb,
} from "@/lib/inventory-map"
import { generateAnydeskAddress } from "@/lib/anydesk"
import { employees } from "@/lib/employees"
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
  }

  for (const row of accessoryRows) {
    const kind = (
      {
        HEADSET: "headset",
        MOUSE: "mouse",
        MONITOR: "monitor",
        BAG: "bag",
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

export async function upsertLaptop(laptop: Laptop): Promise<Laptop> {
  const employeeId = employeeIdFor(laptop.handler)
  const charger = {
    connector: laptop.charger.connector,
    wattage: laptop.charger.wattage,
    partNumber: laptop.charger.partNumber,
    serialNumber: laptop.charger.serialNumber,
    condition: chargerToDb[laptop.charger.condition],
  }
  const anydeskAddress =
    laptop.anydeskAddress || generateAnydeskAddress(laptop.assetTag)

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
      anydeskAddress,
      charger: { create: charger },
      assignments: { create: assignmentData(laptop.history) },
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
      anydeskAddress,
      charger: {
        upsert: {
          create: charger,
          update: charger,
        },
      },
      assignments: {
        deleteMany: {},
        create: assignmentData(laptop.history),
      },
    },
    include: laptopInclude,
  })

  return laptopFromDb(saved)
}

export async function upsertAccessory(item: Accessory): Promise<Accessory> {
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
      assignments: { create: assignmentData(item.history) },
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
      assignments: {
        deleteMany: {},
        create: assignmentData(item.history),
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

  return employees
    .map((employee) => {
      const assigned = laptops.filter((laptop) => laptop.handler === employee.name)
      const laptop =
        assigned.find((item) => item.status === "In use") ?? assigned[0] ?? null
      return { employee, laptop }
    })
    .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
}

export async function backfillAnydeskAddresses() {
  const laptops = await prisma.laptop.findMany({
    where: { OR: [{ anydeskAddress: null }, { anydeskAddress: "" }] },
    select: { id: true, assetTag: true },
  })
  for (const laptop of laptops) {
    await prisma.laptop.update({
      where: { id: laptop.id },
      data: { anydeskAddress: generateAnydeskAddress(laptop.assetTag) },
    })
  }
  return laptops.length
}
