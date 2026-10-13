import { prisma } from "@/lib/prisma"

const REQUEST_EMAIL_SETTINGS_ID = "default"

export const REQUEST_EMAIL_MAX_RECIPIENTS = 20

// An active user of this app, and how they're copied on request emails.
export type RequestEmailAppUser = {
  id: string
  name: string
  // The address they sign in with; where they're copied by default.
  loginEmail: string
  // Where they're copied instead, or null to use `loginEmail`.
  email: string | null
  copied: boolean
}

export type RequestEmailSettings = {
  appUsers: RequestEmailAppUser[]
  // Other addresses to copy.
  extraRecipients: string[]
}

export type RequestEmailSettingsInput = {
  appUsers: Pick<RequestEmailAppUser, "id" | "email" | "copied">[]
  extraRecipients: string[]
}

type Override = { copied?: boolean; email?: string }

const normalize = (email: string) => email.trim().toLowerCase()

const unique = (emails: string[]) => [
  ...new Set(emails.map(normalize).filter(Boolean)),
]

function overridesOf(value: unknown): Record<string, Override> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Override>)
    : {}
}

// Until settings are saved, every active app user is copied at their
// sign-in address and nobody else is.
export async function getRequestEmailSettings(): Promise<RequestEmailSettings> {
  const [row, users] = await Promise.all([
    prisma.requestEmailSettings.findUnique({
      where: { id: REQUEST_EMAIL_SETTINGS_ID },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ])
  const overrides = overridesOf(row?.appUserOverrides)
  return {
    appUsers: users.map((user) => {
      const override = overrides[user.id]
      return {
        id: user.id,
        name: user.name,
        loginEmail: normalize(user.email),
        email:
          typeof override?.email === "string" && override.email.trim()
            ? normalize(override.email)
            : null,
        copied: override?.copied !== false,
      }
    }),
    extraRecipients: row?.extraRecipients ?? [],
  }
}

export async function saveRequestEmailSettings(
  input: RequestEmailSettingsInput,
): Promise<RequestEmailSettings> {
  const appUserOverrides: Record<string, Override> = {}
  for (const user of input.appUsers) {
    const override: Override = {}
    if (!user.copied) override.copied = false
    if (user.email?.trim()) override.email = normalize(user.email)
    if (Object.keys(override).length > 0) appUserOverrides[user.id] = override
  }
  const data = {
    appUserOverrides,
    extraRecipients: unique(input.extraRecipients),
  }
  await prisma.requestEmailSettings.upsert({
    where: { id: REQUEST_EMAIL_SETTINGS_ID },
    create: { id: REQUEST_EMAIL_SETTINGS_ID, ...data },
    update: data,
  })
  return getRequestEmailSettings()
}

// Everyone copied on an asset-request email to the employee.
export async function requestEmailCc(): Promise<string[]> {
  const settings = await getRequestEmailSettings()
  return unique([
    ...settings.appUsers
      .filter((user) => user.copied)
      .map((user) => user.email ?? user.loginEmail),
    ...settings.extraRecipients,
  ])
}
