import "dotenv/config"

import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../lib/generated/prisma"

// One-off: gives every laptop that came with a charger a matching record in
// charger stock, installed in that laptop. Safe to run again; laptops that
// already have one are skipped. Pass --dry-run to only report the count.

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

const conditionLabels = {
  GOOD: "Good",
  WORN_CABLE: "Worn cable",
  REPLACED: "Replaced",
  MISSING: "Good",
} as const

function tagNumber(assetTag: string) {
  const n = Number(assetTag.replace(/\D/g, ""))
  return Number.isFinite(n) ? n : 0
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")

  const laptops = await prisma.laptop.findMany({
    where: {
      charger: { is: { condition: { not: "MISSING" } } },
      installedParts: { none: { kind: "CHARGER", status: "IN_USE" } },
    },
    include: { charger: true },
    orderBy: { assetTag: "asc" },
  })
  if (laptops.length === 0) {
    console.log("Nothing to backfill: every laptop charger is already in stock.")
    return
  }
  if (dryRun) {
    console.log(`${laptops.length} laptops need a charger record (dry run).`)
    return
  }

  const existing = await prisma.accessory.findMany({
    where: { kind: "CHARGER" },
    select: { assetTag: true },
  })
  let next = existing.reduce(
    (highest, row) => Math.max(highest, tagNumber(row.assetTag)),
    0,
  )

  const rows = laptops.flatMap((laptop) => {
    const charger = laptop.charger
    if (!charger) return []
    next += 1
    return [
      {
        id: crypto.randomUUID(),
        assetTag: `CHG-${String(next).padStart(4, "0")}`,
        brand: laptop.brand,
        model: `${charger.wattage}W ${charger.connector}`,
        serialNumber: charger.serialNumber,
        color: laptop.color,
        colorHex: laptop.colorHex,
        purchaseDate: laptop.purchaseDate,
        warrantyYears: laptop.warrantyYears,
        specs: {
          connector: charger.connector,
          wattage: String(charger.wattage),
          partNumber: charger.partNumber,
          condition: conditionLabels[charger.condition],
        },
        laptopId: laptop.id,
        kind: "CHARGER" as const,
        status: "IN_USE" as const,
      },
    ]
  })
  const tagByLaptopId = new Map(laptops.map((l) => [l.id, l.assetTag]))

  // Two batched inserts in one transaction: all of them land, or none do.
  await prisma.$transaction([
    prisma.accessory.createMany({ data: rows }),
    prisma.accessoryAssignment.createMany({
      data: rows.map((row) => ({
        accessoryId: row.id,
        from: row.purchaseDate,
        note: `Issued with ${tagByLaptopId.get(row.laptopId)}`,
      })),
    }),
  ])

  console.log(`Added ${rows.length} chargers to stock.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
