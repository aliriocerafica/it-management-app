import type {
  AccountabilityRow,
  FormBackup,
  FormState,
  FormVersion,
} from "@/lib/accountability-forms"
import { accessoryConfigs, type AccessoryKind } from "@/lib/accessories"
import type { Prisma } from "@/lib/generated/prisma"
import { fetchHrisEmployees } from "@/lib/hris"
import { formatDate } from "@/lib/laptops"
import {
  fillAccountabilityForm,
  type EquipmentRow,
} from "@/lib/pdf/fill-accountability-form"
import { prisma } from "@/lib/prisma"

type Holding = {
  holderName: string
  employeeId: string | null
  department: string | null
  equipment: EquipmentRow[]
}

// Only these go on the form: laptops (with their chargers), headsets and
// laptop bags. Consumables and small peripherals (batteries, mice,
// keyboards, monitors) are left off.
const accountableKinds = ["HEADSET", "BAG"] as const

// Accountable equipment currently assigned to someone (in use or out for
// repair), grouped by holder, as rows for the form's equipment table.
async function currentHoldings(holderName?: string): Promise<Map<string, Holding>> {
  const where = holderName ? { handlerName: holderName } : { handlerName: { not: null } }
  const accessoryWhere = { ...where, kind: { in: [...accountableKinds] } }
  const [laptops, accessories] = await Promise.all([
    prisma.laptop.findMany({
      where,
      select: {
        handlerName: true,
        employeeId: true,
        department: true,
        brand: true,
        model: true,
        serialNumber: true,
        charger: { select: { partNumber: true, serialNumber: true } },
      },
      orderBy: { assetTag: "asc" },
    }),
    prisma.accessory.findMany({
      where: accessoryWhere,
      select: {
        handlerName: true,
        employeeId: true,
        department: true,
        kind: true,
        brand: true,
        model: true,
        serialNumber: true,
      },
      orderBy: [{ kind: "asc" }, { assetTag: "asc" }],
    }),
  ])

  const holdings = new Map<string, Holding>()
  function holding(row: { handlerName: string | null; employeeId: string | null; department: string | null }) {
    const name = row.handlerName!
    let entry = holdings.get(name)
    if (!entry) {
      entry = { holderName: name, employeeId: null, department: null, equipment: [] }
      holdings.set(name, entry)
    }
    entry.employeeId ??= row.employeeId
    entry.department ??= row.department
    return entry
  }

  for (const l of laptops) {
    const entry = holding(l)
    entry.equipment.push(
      { item: "Laptop", brand: l.brand, model: l.model, serialNumber: l.serialNumber, unitCount: 1 },
      {
        item: "Laptop Charger",
        brand: l.brand,
        model: l.charger?.partNumber ?? "",
        serialNumber: l.charger?.serialNumber ?? "",
        unitCount: 1,
      },
    )
  }
  for (const a of accessories) {
    const kind = a.kind.toLowerCase() as AccessoryKind
    holding(a).equipment.push({
      item: accessoryConfigs[kind].singular,
      brand: a.brand,
      model: a.model,
      serialNumber: a.serialNumber,
      unitCount: 1,
    })
  }
  return holdings
}

function signatureOf(equipment: EquipmentRow[]) {
  return JSON.stringify(
    equipment
      .map((row) => [row.item, row.brand, row.model, row.serialNumber].join("|"))
      .sort(),
  )
}

function assetSummary(equipment: EquipmentRow[]) {
  const counts = new Map<string, number>()
  for (const row of equipment) {
    if (row.item === "Laptop Charger") continue
    counts.set(row.item, (counts.get(row.item) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => ({ label, count }))
}

const formInclude = { sends: { orderBy: { sentAt: "desc" } } } satisfies Prisma.AccountabilityFormInclude
type FormRecord = Prisma.AccountabilityFormGetPayload<{ include: typeof formInclude }>

function versionFromDb(row: FormRecord): FormVersion {
  return {
    id: row.id,
    holderName: row.holderName,
    version: row.version,
    hrName: row.hrName,
    itOfficerName: row.itOfficerName,
    generatedOn: row.generatedOn,
    itemCount: (row.equipment as EquipmentRow[]).filter((r) => r.item !== "Laptop Charger").length,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    sends: row.sends.map((send) => ({
      id: send.id,
      toEmail: send.toEmail,
      sentByName: send.sentByName,
      sentAt: send.sentAt.toISOString(),
    })),
  }
}

async function hrisEmails() {
  const byId = new Map<string, string>()
  const byName = new Map<string, string>()
  try {
    for (const e of await fetchHrisEmployees("all")) {
      if (!e.email) continue
      byId.set(e.id, e.email)
      byName.set(e.name.toLowerCase(), e.email)
    }
  } catch (error) {
    console.warn("HRIS unavailable; accountability emails not prefilled", error)
  }
  return (holder: Holding) =>
    (holder.employeeId && byId.get(holder.employeeId)) ||
    byName.get(holder.holderName.toLowerCase()) ||
    null
}

export async function listAccountabilityRows(): Promise<AccountabilityRow[]> {
  const [holdings, forms, emailFor] = await Promise.all([
    currentHoldings(),
    prisma.accountabilityForm.findMany({
      orderBy: { version: "desc" },
      include: formInclude,
    }),
    hrisEmails(),
  ])

  const latestByHolder = new Map<string, FormRecord>()
  const versionCounts = new Map<string, number>()
  for (const form of forms) {
    if (!latestByHolder.has(form.holderName)) latestByHolder.set(form.holderName, form)
    versionCounts.set(form.holderName, (versionCounts.get(form.holderName) ?? 0) + 1)
  }

  return [...holdings.values()]
    .map((holder) => {
      const latest = latestByHolder.get(holder.holderName) ?? null
      const state: FormState = !latest
        ? "No form"
        : latest.signature === signatureOf(holder.equipment)
          ? "Up to date"
          : "Needs update"
      const assets = assetSummary(holder.equipment)
      return {
        holderName: holder.holderName,
        employeeId: holder.employeeId,
        department: holder.department,
        email: emailFor(holder),
        assets,
        itemCount: assets.reduce((sum, a) => sum + a.count, 0),
        latest: latest ? versionFromDb(latest) : null,
        versionCount: versionCounts.get(holder.holderName) ?? 0,
        state,
      }
    })
    .sort((a, b) => a.holderName.localeCompare(b.holderName))
}

// Saves a new form version for what the holder has now. Reuses the latest
// version when nothing on it would change, unless `force` is set.
export async function generateForm(
  holderName: string,
  names: { hrName: string; itOfficerName: string },
  createdByName: string | null,
  force = false,
): Promise<FormVersion> {
  const holder = (await currentHoldings(holderName)).get(holderName)
  if (!holder) throw new Error(`${holderName} has no assigned equipment.`)
  const signature = signatureOf(holder.equipment)

  const latest = await prisma.accountabilityForm.findFirst({
    where: { holderName },
    orderBy: { version: "desc" },
    include: formInclude,
  })
  if (
    latest &&
    !force &&
    latest.signature === signature &&
    latest.hrName === names.hrName &&
    latest.itOfficerName === names.itOfficerName
  ) {
    return versionFromDb(latest)
  }

  const created = await prisma.accountabilityForm.create({
    data: {
      holderName,
      employeeId: holder.employeeId,
      department: holder.department,
      version: (latest?.version ?? 0) + 1,
      hrName: names.hrName,
      itOfficerName: names.itOfficerName,
      generatedOn: formatDate(new Date()),
      equipment: holder.equipment,
      signature,
      createdByName,
    },
    include: formInclude,
  })
  return versionFromDb(created)
}

export async function listFormVersions(holderName: string): Promise<FormVersion[]> {
  const rows = await prisma.accountabilityForm.findMany({
    where: { holderName },
    orderBy: { version: "desc" },
    include: formInclude,
  })
  return rows.map(versionFromDb)
}

export async function renderFormPdf(formId: string) {
  const form = await prisma.accountabilityForm.findUnique({ where: { id: formId } })
  if (!form) return null
  const pdf = await fillAccountabilityForm({
    employeeName: form.holderName,
    itOfficerName: form.itOfficerName,
    hrName: form.hrName,
    generatedOn: form.generatedOn,
    equipment: form.equipment as EquipmentRow[],
  })
  return {
    pdf,
    holderName: form.holderName,
    version: form.version,
    filename: `Accountability Form - ${form.holderName} - v${form.version}.pdf`,
  }
}

export async function recordFormSend(formId: string, toEmail: string, sentByName: string | null) {
  await prisma.accountabilityFormSend.create({ data: { formId, toEmail, sentByName } })
}

async function deleteForms(where: Prisma.AccountabilityFormWhereInput): Promise<FormBackup[]> {
  const rows = await prisma.accountabilityForm.findMany({ where, include: { sends: true } })
  await prisma.accountabilityForm.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })
  return rows.map((row) => ({
    id: row.id,
    holderName: row.holderName,
    employeeId: row.employeeId,
    department: row.department,
    version: row.version,
    hrName: row.hrName,
    itOfficerName: row.itOfficerName,
    generatedOn: row.generatedOn,
    equipment: row.equipment as EquipmentRow[],
    signature: row.signature,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    sends: row.sends.map((send) => ({
      id: send.id,
      toEmail: send.toEmail,
      sentByName: send.sentByName,
      sentAt: send.sentAt.toISOString(),
    })),
  }))
}

export async function deleteFormVersion(formId: string) {
  return deleteForms({ id: formId })
}

// Removes every version (and its send history) for these holders.
export async function deleteFormsFor(holderNames: string[]) {
  return deleteForms({ holderName: { in: holderNames } })
}

// Puts deleted versions back with their original ids, dates and sends.
// A version number taken again in the meantime is skipped.
export async function restoreForms(forms: FormBackup[]) {
  await prisma.accountabilityForm.createMany({
    data: forms.map((form) => ({
      id: form.id,
      holderName: form.holderName,
      employeeId: form.employeeId,
      department: form.department,
      version: form.version,
      hrName: form.hrName,
      itOfficerName: form.itOfficerName,
      generatedOn: form.generatedOn,
      equipment: form.equipment,
      signature: form.signature,
      createdByName: form.createdByName,
      createdAt: new Date(form.createdAt),
    })),
    skipDuplicates: true,
  })
  const restored = new Set(
    (
      await prisma.accountabilityForm.findMany({
        where: { id: { in: forms.map((form) => form.id) } },
        select: { id: true },
      })
    ).map((row) => row.id),
  )
  await prisma.accountabilityFormSend.createMany({
    data: forms
      .filter((form) => restored.has(form.id))
      .flatMap((form) =>
        form.sends.map((send) => ({ ...send, formId: form.id, sentAt: new Date(send.sentAt) })),
      ),
    skipDuplicates: true,
  })
}
