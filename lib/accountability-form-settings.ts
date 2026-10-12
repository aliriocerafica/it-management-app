import { prisma } from "@/lib/prisma"

export const ACCOUNTABILITY_SETTINGS_ID = "default"
export const DEFAULT_HR_NAME = "CAMILLE TUIBEO"
export const DEFAULT_IT_OFFICER_NAME = ""

// Offered alongside whoever was already set, the first time the list of
// IT officers is needed.
const SEEDED_IT_OFFICER = "Paul Angelo Derige"

// Signature images are stored inline, so they're kept small.
export const SIGNATURE_MAX_CHARS = 400_000

export type ItOfficer = {
  id: string
  name: string
  // Copied on forms they sign when those are emailed; null if not set.
  email: string | null
  // PNG or JPEG data URL, or null when no signature is on file.
  signature: string | null
}

export type AccountabilityFormSettings = {
  hrName: string
  hrEmail: string | null
  // PNG or JPEG data URL, or null when no signature is on file.
  hrSignature: string | null
  // The officer picked by default on new forms.
  itOfficerName: string
  itOfficers: ItOfficer[]
}

export type AccountabilityFormSettingsInput = {
  hrName: string
  hrEmail: string | null
  hrSignature: string | null
  itOfficerName: string
  // Without an id, a new officer.
  itOfficers: {
    id?: string
    name: string
    email: string | null
    signature: string | null
  }[]
}

const sameName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

// Whether this is a PNG or JPEG data URL small enough to store.
export function isSignatureDataUrl(value: string) {
  if (value.length > SIGNATURE_MAX_CHARS) return false
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(value)
  if (!match) return false
  const bytes = Buffer.from(match[2].slice(0, 16), "base64")
  return match[1] === "png"
    ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

async function listItOfficers(currentName: string): Promise<ItOfficer[]> {
  const select = { id: true, name: true, email: true, signature: true }
  const orderBy = [{ position: "asc" as const }, { createdAt: "asc" as const }]
  const rows = await prisma.accountabilityFormSignatory.findMany({ select, orderBy })
  if (rows.length > 0) return rows

  const names = [currentName, SEEDED_IT_OFFICER].filter(
    (name, index, all) =>
      name.trim() && all.findIndex((other) => sameName(other, name)) === index,
  )
  await prisma.accountabilityFormSignatory.createMany({
    data: names.map((name, position) => ({ name: name.trim(), position })),
  })
  return prisma.accountabilityFormSignatory.findMany({ select, orderBy })
}

export async function getAccountabilityFormSettings(): Promise<AccountabilityFormSettings> {
  const row = await prisma.accountabilityFormSettings.findUnique({
    where: { id: ACCOUNTABILITY_SETTINGS_ID },
  })
  const itOfficerName = row?.itOfficerName.trim() || DEFAULT_IT_OFFICER_NAME
  return {
    hrName: row?.hrName.trim() || DEFAULT_HR_NAME,
    hrEmail: row?.hrEmail ?? null,
    hrSignature: row?.hrSignature ?? null,
    itOfficerName,
    itOfficers: await listItOfficers(itOfficerName),
  }
}

export async function saveAccountabilityFormSettings(
  input: AccountabilityFormSettingsInput,
): Promise<AccountabilityFormSettings> {
  const keptIds = input.itOfficers.flatMap((officer) => (officer.id ? [officer.id] : []))
  await prisma.$transaction([
    prisma.accountabilityFormSettings.upsert({
      where: { id: ACCOUNTABILITY_SETTINGS_ID },
      create: {
        id: ACCOUNTABILITY_SETTINGS_ID,
        hrName: input.hrName,
        hrEmail: input.hrEmail,
        hrSignature: input.hrSignature,
        itOfficerName: input.itOfficerName,
      },
      update: {
        hrName: input.hrName,
        hrEmail: input.hrEmail,
        hrSignature: input.hrSignature,
        itOfficerName: input.itOfficerName,
      },
    }),
    prisma.accountabilityFormSignatory.deleteMany({
      where: { id: { notIn: keptIds } },
    }),
    ...input.itOfficers.map((officer, position) => {
      const data = {
        name: officer.name,
        email: officer.email,
        signature: officer.signature,
        position,
      }
      return officer.id
        ? prisma.accountabilityFormSignatory.updateMany({ where: { id: officer.id }, data })
        : prisma.accountabilityFormSignatory.create({ data })
    }),
  ])
  return getAccountabilityFormSettings()
}

// Who to copy when a form is emailed to its holder: the IT Officer and HR
// named on it, where an email address is on file for them.
export async function signatoryEmails(form: { itOfficerName: string; hrName: string }) {
  const [officers, settings] = await Promise.all([
    prisma.accountabilityFormSignatory.findMany({
      where: { email: { not: null } },
      select: { name: true, email: true },
    }),
    prisma.accountabilityFormSettings.findUnique({
      where: { id: ACCOUNTABILITY_SETTINGS_ID },
      select: { hrName: true, hrEmail: true },
    }),
  ])
  return [
    officers.find((officer) => sameName(officer.name, form.itOfficerName))?.email,
    settings && sameName(settings.hrName, form.hrName) ? settings.hrEmail : null,
  ].filter((email): email is string => Boolean(email))
}

// The HR signature on file, if this is the HR name it belongs to.
export async function hrSignature(name: string) {
  const row = await prisma.accountabilityFormSettings.findUnique({
    where: { id: ACCOUNTABILITY_SETTINGS_ID },
    select: { hrName: true, hrSignature: true },
  })
  return row && sameName(row.hrName, name) ? row.hrSignature : null
}

// The signature on file for whoever signs as this IT Officer, if any.
export async function itOfficerSignature(name: string) {
  const officers = await prisma.accountabilityFormSignatory.findMany({
    where: { signature: { not: null } },
    select: { name: true, signature: true },
  })
  return officers.find((officer) => sameName(officer.name, name))?.signature ?? null
}
