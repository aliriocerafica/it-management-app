import type { Accessory, AccessoryKind } from "@/lib/accessories"
import type { IssuedHolding } from "@/lib/issue-stock"
import {
  accessoryFromDb,
  assignmentData,
  chargerFromDb,
  chargerToDb,
  fromIsoDate,
  type EmployeeIdLookup,
  kindFromDb,
  kindToDb,
  laptopFromDb,
  statusFromDb,
  statusToDb,
} from "@/lib/inventory-map"
import {
  chargerFromAccessory,
  chargerToSpecs,
  missingCharger,
} from "@/lib/chargers"
import { digitsOnly } from "@/lib/anydesk"
import { encryptSecret } from "@/lib/crypto"
import { employees } from "@/lib/employees"
import { fetchHrisEmployees } from "@/lib/hris"
import type { Charger, Laptop } from "@/lib/laptops"
import type { InventorySummary, StatusCounts, VacantCounts } from "@/lib/inventory-map"
import type { Prisma } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { adjustRam, ramChanges, withInstallState } from "@/lib/ram"
import { todayIsoDate } from "@/lib/inventory-lifecycle"
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
    ram: emptyCounts(),
    charger: emptyCounts(),
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
        RAM: "ram",
        CHARGER: "charger",
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

export async function getVacantCounts(): Promise<VacantCounts> {
  const [laptopCount, accessoryRows] = await Promise.all([
    prisma.laptop.count({ where: { status: "VACANT" } }),
    prisma.accessory.groupBy({
      by: ["kind"],
      where: { status: "VACANT" },
      _count: { _all: true },
    }),
  ])

  const counts: VacantCounts = {
    laptops: laptopCount,
    headset: 0,
    mouse: 0,
    monitor: 0,
    bag: 0,
    battery: 0,
    keyboard: 0,
    ram: 0,
    charger: 0,
  }
  for (const row of accessoryRows) {
    counts[kindFromDb[row.kind]] = row._count._all
  }
  return counts
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

  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.laptop.upsert({
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
        price: laptop.price ?? null,
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
        price: laptop.price ?? null,
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
    await syncLaptopChargerAccessory(tx, laptop)
    return tx.laptop.findUniqueOrThrow({
      where: { id: row.id },
      include: laptopInclude,
    })
  })

  return laptopFromDb(saved)
}

export async function upsertAccessory(input: Accessory): Promise<Accessory> {
  const item = withInstallState(input)
  const employeeIdFor = await employeeIdLookup()
  const employeeId = employeeIdFor(item.handler)
  const laptopId = item.laptopId ?? null
  // Saved together with any change it makes to a laptop's memory, so the
  // two can't drift apart.
  const saved = await prisma.$transaction(async (tx) => {
    const before = await tx.accessory.findUnique({
      where: { id: item.id },
      select: { kind: true, status: true, laptopId: true, specs: true },
    })
    const row = await tx.accessory.upsert({
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
        price: item.price ?? null,
        status: statusToDb[item.status],
        specs: item.specs,
        repairIssue: item.repairIssue?.trim() || null,
        laptopId,
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
        price: item.price ?? null,
        status: statusToDb[item.status],
        specs: item.specs,
        repairIssue: item.repairIssue?.trim() || null,
        laptopId,
        assignments: {
          deleteMany: {},
          create: assignmentData(item.history, employeeIdFor),
        },
      },
      include: accessoryInclude,
    })
    await applyRamChanges(
      tx,
      ramChanges(before && installableFromDb(before), item),
    )
    await applyChargerChanges(
      tx,
      before && installableFromDb(before),
      item,
    )
    return row
  })

  return accessoryFromDb(saved)
}

export async function deleteLaptops(ids: string[]) {
  await prisma.$transaction(async (tx) => {
    // RAM installed in a deleted laptop goes back to stock rather than
    // staying "In use" in a laptop that no longer exists.
    const installed = await tx.accessory.findMany({
      where: { laptopId: { in: ids } },
      select: { id: true, laptop: { select: { assetTag: true } } },
    })
    if (installed.length) {
      const today = fromIsoDate(todayIsoDate())
      const accessoryIds = installed.map((row) => row.id)
      await tx.accessoryAssignment.updateMany({
        where: { accessoryId: { in: accessoryIds }, to: null },
        data: { to: today },
      })
      await tx.accessoryAssignment.createMany({
        data: installed.map((row) => ({
          accessoryId: row.id,
          from: today,
          note: `Removed from ${row.laptop?.assetTag ?? "a laptop"} when it was deleted`,
        })),
      })
      await tx.accessory.updateMany({
        where: { id: { in: accessoryIds } },
        data: { laptopId: null, status: "VACANT" },
      })
    }
    await tx.laptop.deleteMany({ where: { id: { in: ids } } })
  })
}

export async function deleteAccessories(ids: string[]) {
  await prisma.$transaction(async (tx) => {
    const installed = await tx.accessory.findMany({
      where: { id: { in: ids }, laptopId: { not: null } },
      select: { kind: true, status: true, laptopId: true, specs: true },
    })
    // Deleting an installed module takes its memory out of the laptop.
    const changes = new Map<string, number>()
    for (const row of installed) {
      for (const [laptopId, gb] of ramChanges(installableFromDb(row), null)) {
        changes.set(laptopId, (changes.get(laptopId) ?? 0) + gb)
      }
    }
    await applyRamChanges(tx, changes)
    for (const row of installed) {
      if (kindFromDb[row.kind] !== "charger" || !row.laptopId) continue
      await markLaptopChargerMissing(tx, row.laptopId)
    }
    await tx.accessory.deleteMany({ where: { id: { in: ids } } })
  })
}

function installableFromDb(row: {
  kind: keyof typeof kindFromDb
  status: keyof typeof statusFromDb
  laptopId: string | null
  specs: unknown
}) {
  return {
    kind: kindFromDb[row.kind],
    status: statusFromDb[row.status],
    laptopId: row.laptopId,
    specs: (row.specs ?? {}) as Record<string, string>,
  }
}

function chargerInstall(
  item: { kind: string; status: string; laptopId?: string | null } | null | undefined,
) {
  if (
    !item ||
    item.kind !== "charger" ||
    item.status !== "In use" ||
    !item.laptopId
  ) {
    return null
  }
  return item
}

function chargerTagNumber(assetTag: string) {
  const n = Number(assetTag.replace(/\D/g, ""))
  return Number.isFinite(n) ? n : 0
}

function chargerAssetTag(n: number) {
  return `CHG-${String(n).padStart(4, "0")}`
}

async function nextChargerAssetTag(tx: Prisma.TransactionClient) {
  const rows = await tx.accessory.findMany({
    where: { kind: "CHARGER" },
    select: { assetTag: true },
  })
  const max = rows.reduce(
    (highest, row) => Math.max(highest, chargerTagNumber(row.assetTag)),
    0,
  )
  return chargerAssetTag(max + 1)
}

async function vacateChargerAccessory(
  tx: Prisma.TransactionClient,
  accessoryId: string,
  laptopAssetTag: string,
) {
  const today = fromIsoDate(todayIsoDate())
  await tx.accessoryAssignment.updateMany({
    where: { accessoryId, to: null },
    data: { to: today },
  })
  await tx.accessoryAssignment.create({
    data: {
      accessoryId,
      from: today,
      note: `Removed from ${laptopAssetTag}, back in stock`,
    },
  })
  await tx.accessory.update({
    where: { id: accessoryId },
    data: {
      laptopId: null,
      status: "VACANT",
      handlerName: null,
      department: null,
      employeeId: null,
    },
  })
}

async function writeLaptopChargerSnapshot(
  tx: Prisma.TransactionClient,
  laptopId: string,
  charger: Charger,
) {
  const data = {
    connector: charger.connector,
    wattage: charger.wattage,
    partNumber: charger.partNumber,
    serialNumber: charger.serialNumber,
    condition: chargerToDb[charger.condition],
  }
  await tx.laptopCharger.upsert({
    where: { laptopId },
    create: { laptopId, ...data },
    update: data,
  })
}

async function markLaptopChargerMissing(
  tx: Prisma.TransactionClient,
  laptopId: string,
) {
  const laptop = await tx.laptop.findUnique({
    where: { id: laptopId },
    include: { charger: true },
  })
  if (!laptop?.charger) return
  await writeLaptopChargerSnapshot(
    tx,
    laptopId,
    missingCharger({
      connector: laptop.charger.connector,
      wattage: laptop.charger.wattage,
      partNumber: laptop.charger.partNumber,
      serialNumber: laptop.charger.serialNumber,
      condition: chargerFromDb[laptop.charger.condition],
    }),
  )
}

async function returnOtherChargersOnLaptop(
  tx: Prisma.TransactionClient,
  laptopId: string,
  keepId: string,
  laptopAssetTag: string,
) {
  const others = await tx.accessory.findMany({
    where: {
      kind: "CHARGER",
      laptopId,
      status: "IN_USE",
      id: { not: keepId },
    },
    select: { id: true },
  })
  for (const other of others) {
    await vacateChargerAccessory(tx, other.id, laptopAssetTag)
  }
}

async function applyChargerChanges(
  tx: Prisma.TransactionClient,
  before: ReturnType<typeof installableFromDb> | null,
  after: Accessory,
) {
  if (before?.kind !== "charger" && after.kind !== "charger") return

  const from = chargerInstall(before)
  const to = chargerInstall(after)

  if (to?.laptopId) {
    const laptop = await tx.laptop.findUnique({
      where: { id: to.laptopId },
      select: { assetTag: true },
    })
    if (laptop) {
      await returnOtherChargersOnLaptop(
        tx,
        to.laptopId,
        after.id,
        laptop.assetTag,
      )
      await writeLaptopChargerSnapshot(
        tx,
        to.laptopId,
        chargerFromAccessory(after),
      )
    }
  }

  if (from?.laptopId && from.laptopId !== to?.laptopId) {
    const still = await tx.accessory.findFirst({
      where: {
        kind: "CHARGER",
        laptopId: from.laptopId,
        status: "IN_USE",
      },
    })
    if (!still) await markLaptopChargerMissing(tx, from.laptopId)
  }
}

async function syncLaptopChargerAccessory(
  tx: Prisma.TransactionClient,
  laptop: Laptop,
) {
  const installed = await tx.accessory.findFirst({
    where: { kind: "CHARGER", laptopId: laptop.id, status: "IN_USE" },
  })
  if (laptop.charger.condition === "Missing") {
    if (installed) await vacateChargerAccessory(tx, installed.id, laptop.assetTag)
    return
  }
  const specs = chargerToSpecs(laptop.charger)
  const model = `${laptop.charger.wattage}W ${laptop.charger.connector}`
  if (installed) {
    // A charger from stock keeps its own brand and model. Only a model that
    // was generated from the specs (as below) follows them when they change.
    const previous = (installed.specs ?? {}) as Record<string, string>
    const generatedModel =
      installed.model === `${previous.wattage}W ${previous.connector}`
    await tx.accessory.update({
      where: { id: installed.id },
      data: {
        serialNumber: laptop.charger.serialNumber,
        specs,
        ...(generatedModel ? { model } : {}),
      },
    })
    return
  }
  await tx.accessory.create({
    data: {
      id: crypto.randomUUID(),
      kind: "CHARGER",
      assetTag: await nextChargerAssetTag(tx),
      brand: laptop.brand,
      model,
      serialNumber: laptop.charger.serialNumber,
      color: laptop.color,
      colorHex: laptop.colorHex,
      purchaseDate: fromIsoDate(laptop.purchaseDate),
      warrantyYears: laptop.warrantyYears,
      status: "IN_USE",
      specs,
      laptopId: laptop.id,
      assignments: {
        create: {
          from: fromIsoDate(laptop.purchaseDate),
          note: `Issued with ${laptop.assetTag}`,
        },
      },
    },
  })
}

// Adds (or takes away) installed RAM from each laptop's memory total.
async function applyRamChanges(
  tx: Prisma.TransactionClient,
  changes: Map<string, number>,
) {
  for (const [laptopId, gb] of changes) {
    const laptop = await tx.laptop.findUnique({
      where: { id: laptopId },
      select: { ram: true },
    })
    if (!laptop) continue
    const ram = adjustRam(laptop.ram, gb)
    if (ram !== laptop.ram) {
      await tx.laptop.update({ where: { id: laptopId }, data: { ram } })
    }
  }
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

// In-use laptops, headsets, RAM, and other tracked gear, with the person who has them.
// RAM counts as issued to whoever holds the laptop it is installed in.
export async function listIssuedHoldings(): Promise<IssuedHolding[]> {
  const [laptops, accessories] = await Promise.all([
    prisma.laptop.findMany({
      where: { status: "IN_USE", handlerName: { not: null } },
      select: {
        id: true,
        assetTag: true,
        brand: true,
        model: true,
        serialNumber: true,
        handlerName: true,
      },
    }),
    prisma.accessory.findMany({
      where: { status: "IN_USE" },
      select: {
        id: true,
        kind: true,
        assetTag: true,
        brand: true,
        model: true,
        serialNumber: true,
        handlerName: true,
        laptop: { select: { assetTag: true, handlerName: true } },
      },
    }),
  ])

  const holdings: IssuedHolding[] = []
  for (const laptop of laptops) {
    if (!laptop.handlerName) continue
    holdings.push({
      id: laptop.id,
      kind: "laptop",
      assetTag: laptop.assetTag,
      brand: laptop.brand,
      model: laptop.model,
      serialNumber: laptop.serialNumber,
      holder: laptop.handlerName,
      installedIn: null,
    })
  }
  for (const item of accessories) {
    const holder =
      item.kind === "RAM" || item.kind === "CHARGER"
        ? item.laptop?.handlerName || item.handlerName
        : item.handlerName
    if (!holder) continue
    holdings.push({
      id: item.id,
      kind: kindFromDb[item.kind],
      assetTag: item.assetTag,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber,
      holder,
      installedIn:
        item.kind === "RAM" || item.kind === "CHARGER"
          ? item.laptop?.assetTag ?? null
          : null,
    })
  }
  return holdings
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
