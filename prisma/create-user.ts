import "dotenv/config"

import { PrismaNeon } from "@prisma/adapter-neon"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../lib/generated/prisma"

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found?.slice(prefix.length)
}

async function main() {
  const name = arg("name")
  const email = arg("email")?.toLowerCase()
  const password = arg("password")
  const role = (arg("role") ?? "ADMIN") as "ADMIN" | "STAFF"

  if (!name || !email || !password) {
    console.error(
      "Usage: npx tsx prisma/create-user.ts --name=\"Full Name\" --email=user@example.com --password=\"secret\" [--role=ADMIN|STAFF]",
    )
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role, isActive: true },
    create: { name, email, passwordHash, role },
  })

  console.log(`User ready: ${user.email} (${user.role}, id=${user.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
