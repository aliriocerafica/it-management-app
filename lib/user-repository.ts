import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/crypto"
import type { UserRole } from "@/lib/generated/prisma"

export type { UserRole }

export type UserDto = {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

function toDto(user: {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function listUsers(): Promise<UserDto[]> {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } })
  return users.map(toDto)
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  role?: UserRole
}): Promise<UserDto> {
  const passwordHash = await hashPassword(input.password)
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
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
