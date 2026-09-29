import "dotenv/config"

import { PrismaNeon } from "@prisma/adapter-neon"
import { generateAnydeskAddress } from "../lib/anydesk"
import {
  initialAccessories,
  type AccessoryKind,
} from "../lib/accessories"
import { employees } from "../lib/employees"
import { PrismaClient } from "../lib/generated/prisma"
import {
  initialLaptops,
  type ChargerCondition,
  type LaptopStatus,
  type OwnershipEntry,
} from "../lib/laptops"

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

const employeeByName = new Map(employees.map((employee) => [employee.name, employee]))

function employeeRef(name: string | null | undefined) {
  if (!name) return { employeeId: null, handlerName: null }
  return {
    employeeId: employeeByName.get(name)?.id ?? null,
    handlerName: name,
  }
}

function mapStatus(status: LaptopStatus) {
  switch (status) {
    case "In use":
      return "IN_USE" as const
    case "Vacant":
      return "VACANT" as const
    case "In repair":
      return "IN_REPAIR" as const
    case "Retired":
      return "RETIRED" as const
  }
}

function mapChargerCondition(condition: ChargerCondition) {
  switch (condition) {
    case "Good":
      return "GOOD" as const
    case "Worn cable":
      return "WORN_CABLE" as const
    case "Replaced":
      return "REPLACED" as const
    case "Missing":
      return "MISSING" as const
  }
}

function mapKind(kind: AccessoryKind) {
  switch (kind) {
    case "headset":
      return "HEADSET" as const
    case "mouse":
      return "MOUSE" as const
    case "monitor":
      return "MONITOR" as const
    case "bag":
      return "BAG" as const
  }
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function assignmentRows(history: OwnershipEntry[]) {
  return history.map((entry) => ({
    ...employeeRef(entry.handler),
    department: entry.department ?? employeeByName.get(entry.handler ?? "")?.department ?? null,
    from: toDate(entry.from),
    to: entry.to ? toDate(entry.to) : null,
    note: entry.note ?? null,
  }))
}

async function main() {
  await prisma.accessoryAssignment.deleteMany()
  await prisma.laptopAssignment.deleteMany()
  await prisma.accessory.deleteMany()
  await prisma.laptopCharger.deleteMany()
  await prisma.laptop.deleteMany()

  for (const laptop of initialLaptops) {
    const current = employeeRef(laptop.handler)
    await prisma.laptop.create({
      data: {
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
        employeeId: current.employeeId,
        handlerName: laptop.handler,
        department: laptop.department,
        purchaseDate: toDate(laptop.purchaseDate),
        warrantyYears: laptop.warrantyYears,
        status: mapStatus(laptop.status),
        repairIssue: laptop.status === "In repair" ? laptop.repairIssue ?? null : null,
        anydeskAddress: generateAnydeskAddress(laptop.assetTag),
        charger: {
          create: {
            connector: laptop.charger.connector,
            wattage: laptop.charger.wattage,
            partNumber: laptop.charger.partNumber,
            serialNumber: laptop.charger.serialNumber,
            condition: mapChargerCondition(laptop.charger.condition),
          },
        },
        assignments: {
          create: assignmentRows(laptop.history),
        },
      },
    })
  }

  for (const items of Object.values(initialAccessories)) {
    for (const item of items) {
      const current = employeeRef(item.handler)
      await prisma.accessory.create({
        data: {
          id: item.id,
          kind: mapKind(item.kind),
          assetTag: item.assetTag,
          brand: item.brand,
          model: item.model,
          serialNumber: item.serialNumber,
          color: item.color,
          colorHex: item.colorHex,
          employeeId: current.employeeId,
          handlerName: item.handler,
          department: item.department,
          purchaseDate: toDate(item.purchaseDate),
          warrantyYears: item.warrantyYears,
          status: mapStatus(item.status),
          specs: item.specs,
          assignments: {
            create: assignmentRows(item.history),
          },
        },
      })
    }
  }

  const [laptops, accessories, laptopAssignments, accessoryAssignments] =
    await Promise.all([
      prisma.laptop.count(),
      prisma.accessory.count(),
      prisma.laptopAssignment.count(),
      prisma.accessoryAssignment.count(),
    ])

  console.log(
    `Seeded ${laptops} laptops, ${accessories} accessories, ${laptopAssignments} laptop assignments, ${accessoryAssignments} accessory assignments.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
