import "dotenv/config"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "../lib/generated/prisma/client.js"

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

const [laptops, accessories, assigned, vacant] = await Promise.all([
  prisma.laptop.count(),
  prisma.accessory.count(),
  prisma.laptop.count({ where: { employeeId: { not: null } } }),
  prisma.laptop.count({ where: { status: "VACANT" } }),
])

const sample = await prisma.laptop.findFirst({
  where: { employeeId: { not: null } },
  select: { assetTag: true, handlerName: true, employeeId: true, status: true },
})

console.log({ laptops, accessories, assignedLaptops: assigned, vacantLaptops: vacant, sample })
await prisma.$disconnect()
