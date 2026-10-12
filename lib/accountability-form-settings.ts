import { prisma } from "@/lib/prisma"

export const ACCOUNTABILITY_SETTINGS_ID = "default"
export const DEFAULT_HR_NAME = "CAMILLE TUIBEO"
export const DEFAULT_IT_OFFICER_NAME = ""

// Offered alongside whoever was already set, the first time the list of
// IT officers is needed.
const SEEDED_IT_OFFICER = "Paul Angelo Derige"

// Signature images are stored inline, so they're kept small.
export const SIGNATURE_MAX_CHARS = 400_000

// Which line of the form someone signs on.
type Role = "IT" | "HR"

export type Signatory = {
  id: string
  name: string
  // Copied on forms they sign when those are emailed; null if not set.
  email: string | null
  // PNG or JPEG data URL, or null when no signature is on file.
  signature: string | null
}

// Without an id, someone new.
export type SignatoryInput = Omit<Signatory, "id"> & { id?: string }

export type AccountabilityFormSettings = {
  // The HR signatory picked by default on new forms.
  hrName: string
  hrOfficers: Signatory[]
  // The IT officer picked by default on new forms.
  itOfficerName: string
  itOfficers: Signatory[]
}

export type AccountabilityFormSettingsInput = {
  hrName: string
  hrOfficers: SignatoryInput[]
  itOfficerName: string
  itOfficers: SignatoryInput[]
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

// The signatories for one role. The first time a role is asked for, its
// list is started from `seed`.
async function listSignatories(
  role: Role,
  seed: () => Omit<Signatory, "id">[],
): Promise<Signatory[]> {
  const query = {
    where: { role },
    select: { id: true, name: true, email: true, signature: true },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
  }
  const rows = await prisma.accountabilityFormSignatory.findMany(query)
  if (rows.length > 0) return rows

  const people = seed().filter(
    (person, index, all) =>
      person.name.trim() &&
      all.findIndex((other) => sameName(other.name, person.name)) === index,
  )
  if (people.length === 0) return []
  await prisma.accountabilityFormSignatory.createMany({
    data: people.map((person, position) => ({
      ...person,
      name: person.name.trim(),
      role,
      position,
    })),
  })
  return prisma.accountabilityFormSignatory.findMany(query)
}

export async function getAccountabilityFormSettings(): Promise<AccountabilityFormSettings> {
  const row = await prisma.accountabilityFormSettings.findUnique({
    where: { id: ACCOUNTABILITY_SETTINGS_ID },
  })
  const itOfficerName = row?.itOfficerName.trim() || DEFAULT_IT_OFFICER_NAME
  const hrName = row?.hrName.trim() || DEFAULT_HR_NAME
  const [itOfficers, hrOfficers] = await Promise.all([
    listSignatories("IT", () =>
      [itOfficerName, SEEDED_IT_OFFICER].map((name) => ({
        name,
        email: null,
        signature: null,
      })),
    ),
    // HR used to be a single name kept on the settings row itself.
    listSignatories("HR", () => [
      {
        name: hrName,
        email: row?.hrEmail ?? null,
        signature: row?.hrSignature ?? null,
      },
    ]),
  ])
  return { hrName, hrOfficers, itOfficerName, itOfficers }
}

export async function saveAccountabilityFormSettings(
  input: AccountabilityFormSettingsInput,
): Promise<AccountabilityFormSettings> {
  const lists = [
    { role: "IT" as const, people: input.itOfficers },
    { role: "HR" as const, people: input.hrOfficers },
  ]
  const keptIds = lists.flatMap(({ people }) =>
    people.flatMap((person) => (person.id ? [person.id] : [])),
  )
  const names = { hrName: input.hrName, itOfficerName: input.itOfficerName }
  await prisma.$transaction([
    prisma.accountabilityFormSettings.upsert({
      where: { id: ACCOUNTABILITY_SETTINGS_ID },
      create: { id: ACCOUNTABILITY_SETTINGS_ID, ...names },
      update: names,
    }),
    prisma.accountabilityFormSignatory.deleteMany({
      where: { id: { notIn: keptIds } },
    }),
    ...lists.flatMap(({ role, people }) =>
      people.map((person, position) => {
        const data = {
          name: person.name,
          email: person.email,
          signature: person.signature,
          role,
          position,
        }
        return person.id
          ? prisma.accountabilityFormSignatory.updateMany({
              where: { id: person.id },
              data,
            })
          : prisma.accountabilityFormSignatory.create({ data })
      }),
    ),
  ])
  return getAccountabilityFormSettings()
}

// Who to copy when a form is emailed to its holder: the IT Officer and HR
// named on it, where an email address is on file for them.
export async function signatoryEmails(form: { itOfficerName: string; hrName: string }) {
  const people = await prisma.accountabilityFormSignatory.findMany({
    where: { email: { not: null } },
    select: { name: true, email: true, role: true },
  })
  const emailOf = (role: Role, name: string) =>
    people.find((person) => person.role === role && sameName(person.name, name))?.email
  return [emailOf("IT", form.itOfficerName), emailOf("HR", form.hrName)].filter(
    (email): email is string => Boolean(email),
  )
}

async function signatureOf(role: Role, name: string) {
  const people = await prisma.accountabilityFormSignatory.findMany({
    where: { role, signature: { not: null } },
    select: { name: true, signature: true },
  })
  return people.find((person) => sameName(person.name, name))?.signature ?? null
}

// The signature on file for whoever signs as this HR name, if any.
export function hrSignature(name: string) {
  return signatureOf("HR", name)
}

// The signature on file for whoever signs as this IT Officer, if any.
export function itOfficerSignature(name: string) {
  return signatureOf("IT", name)
}
