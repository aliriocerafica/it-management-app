import { prisma } from "@/lib/prisma"
import { generateOpaqueToken, hashPassword } from "@/lib/crypto"
import type { UserRole } from "@/lib/generated/prisma"

export type { UserRole }

export type UserDto = {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  // Invited by email and hasn't set a password yet.
  setupPending: boolean
  lastLoginAt: string | null
  createdAt: string
}

function toDto(user: {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  mustSetPassword: boolean
  lastLoginAt: Date | null
  createdAt: Date
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    setupPending: user.mustSetPassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function listUsers(): Promise<UserDto[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } })
  return users.map(toDto)
}

export async function listActiveItEmails(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { email: true },
  })
  return [
    ...new Set(
      users
        .map((user) => user.email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

// Without a password, the user is invited: they can't sign in until they
// choose one through an emailed setup link.
export async function createUser(input: {
  name: string
  email: string
  password?: string
  role?: UserRole
}): Promise<UserDto> {
  const passwordHash = await hashPassword(input.password ?? generateOpaqueToken())
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      mustSetPassword: input.password === undefined,
      role: input.role ?? "ADMIN",
    },
  })
  return toDto(user)
}

export async function countActiveAdmins(excludingUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
    },
  })
}

export async function updateUser(
  id: string,
  patch: { isActive?: boolean; role?: UserRole },
): Promise<UserDto> {
  const user = await prisma.user.update({ where: { id }, data: patch })
  return toDto(user)
}
