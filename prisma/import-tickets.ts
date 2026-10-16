// Imports tickets exported from the old ticket system into the tickets table.
//
//   npx tsx prisma/import-tickets.ts <tickets.json> [--archive-old] [--commit]
//
// The JSON holds the export's two sheets as rows keyed by column header:
// { "live": [...], "archive": [...] }. Without --commit it only prints what
// it would import. Each ticket keeps its old id in `sourceId`, so running it
// again updates those tickets instead of adding copies. Ticket numbers run
// oldest first, and new tickets continue after the highest one.
//
// --archive-old puts the old log ("archive" sheet) in the Archived tab
// instead of Closed Tickets.

import "dotenv/config"

import { readFileSync } from "node:fs"

import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient, type Prisma } from "../lib/generated/prisma"

type Row = Record<string, string>

const [file] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
const commit = process.argv.includes("--commit")
const archiveOld = process.argv.includes("--archive-old")
if (!file) {
  console.error("Usage: npx tsx prisma/import-tickets.ts <tickets.json> [--archive-old] [--commit]")
  process.exit(1)
}

const { live = [], archive = [] } = JSON.parse(readFileSync(file, "utf8")) as {
  live?: Row[]
  archive?: Row[]
}

// Export times are Philippine time, e.g. "2026-10-13 01:34" or "2026-10-13".
function pht(value: string) {
  const [day, time = "00:00"] = value.trim().split(" ")
  const date = new Date(`${day}T${time}:00+08:00`)
  if (Number.isNaN(date.getTime())) throw new Error(`Bad date: ${value}`)
  return date
}

const clean = (value: string | undefined) =>
  value?.replace(/\s+/g, " ").trim() || null

// Same type spelled with different capitals becomes one category, using the
// first spelling seen.
const categorySpelling = new Map<string, string>()
function category(value: string | undefined) {
  const name = clean(value) ?? "Other"
  const key = name.toLowerCase()
  if (!categorySpelling.has(key)) categorySpelling.set(key, name)
  return categorySpelling.get(key)!
}

const assigneeAliases: Record<string, string> = {
  "Alejandro Cerafica": "Alejandro Cerafica Jr.",
  "Alejandro Cerafica Jr": "Alejandro Cerafica Jr.",
  "IT Dept": "IT",
}
function assignee(value: string | undefined) {
  const name = clean(value)
  return name ? assigneeAliases[name] ?? name : null
}

const priorities: Record<string, Prisma.TicketCreateInput["priority"]> = {
  LOW: "LOW",
  MEDIUM: "NORMAL",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
}

const workLocations: Record<string, string> = { ONSITE: "Onsite", WFH: "WFH" }

// The last "Close" entry of an update log, e.g.
// "2026-10-09 00:59 Close — headset mic button off, human error".
function lastClose(log: string) {
  const entries = log
    .split("\n")
    .map((line) => line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) Close(?:\s*\S\s*(.*))?$/))
    .filter((match) => match !== null)
  const last = entries.at(-1)
  return last ? { at: pht(last[1]), note: clean(last[2]) } : null
}

type Imported = Omit<Prisma.TicketCreateInput, "ticketNo"> & {
  sourceId: string
  createdAt: Date
}

const fromLive: Imported[] = live.map((row) => {
  const type = category(row["Type"])
  const notes = clean(row["Employee notes"]) ?? ""
  const createdAt = pht(row["Created (PHT)"])
  const log = row["Update log"]?.trim() ?? ""
  const close = lastClose(log)
  const closedAt = row["Resolved (PHT)"]
    ? pht(row["Resolved (PHT)"])
    : close && close.at > createdAt
      ? close.at
      : createdAt
  const shortNotes = notes.length > 0 && notes.length <= 80
  return {
    sourceId: row["Ticket ID"],
    employeeId: clean(row["Employee no."]),
    requesterName: clean(row["Employee name"]) ?? "Unknown",
    workLocation: workLocations[row["Work location"]?.toUpperCase()] ?? null,
    category: type,
    // The old system had no subject line: short notes become the subject,
    // otherwise the type does and the notes stay in the description.
    subject: shortNotes ? notes : type,
    description: shortNotes ? "" : notes,
    priority: priorities[row["Priority"]?.toUpperCase()] ?? "NORMAL",
    status: "CLOSED",
    assignedTo: assignee(row["Assigned to"]),
    resolutionNote: close?.note ?? null,
    importedLog: log || null,
    createdAt,
    closedAt,
  }
})

const fromArchive: Imported[] = archive.map((row) => {
  const type = category(row["Troubleshooting type"])
  const createdAt = pht(row["Ticket date (PHT)"])
  const seconds = Number(row["Time resolved (seconds)"])
  return {
    sourceId: row["Archive ID"],
    requesterName: clean(row["Requester"]) ?? "Unknown",
    department: clean(row["Account"]),
    category: type,
    subject: type,
    description: "",
    priority: "NORMAL",
    status: archiveOld ? "ARCHIVED" : "CLOSED",
    archivedFrom: archiveOld ? "CLOSED" : null,
    assignedTo: assignee(row["Assigned to"]),
    satisfaction: clean(row["Satisfaction"]),
    // Only the day is known, so it opens at midnight and closes after the
    // logged resolution time.
    createdAt,
    closedAt: new Date(
      createdAt.getTime() + (Number.isFinite(seconds) ? seconds * 1000 : 0),
    ),
  }
})

const all = [...fromArchive, ...fromLive].sort(
  (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
)

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const existing = await prisma.ticket
    .findMany({ select: { sourceId: true, ticketNo: true } })
    .catch((error: unknown) => {
      // A dry run can go ahead before `npm run db:push` creates the table.
      if (commit || (error as { code?: string }).code !== "P2021") throw error
      console.log("(The tickets table doesn't exist yet; run `npm run db:push` before --commit.)\n")
      return []
    })
  const numberBySource = new Map(
    existing.flatMap((t) => (t.sourceId ? [[t.sourceId, t.ticketNo]] : [])),
  )
  let nextNo = Math.max(0, ...existing.map((t) => t.ticketNo)) + 1
  const rows = all.map((ticket) => ({
    ...ticket,
    ticketNo: numberBySource.get(ticket.sourceId) ?? nextNo++,
  }))
  const updates = rows.filter((t) => numberBySource.has(t.sourceId)).length

  const count = (key: (t: Imported) => string | null | undefined) => {
    const counts = new Map<string, number>()
    for (const t of rows) {
      const k = key(t) ?? "(none)"
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1])
  }
  console.log(`${rows.length} tickets: ${fromLive.length} live, ${fromArchive.length} from the old log`)
  console.log(`${rows.length - updates} new, ${updates} already imported (will be updated)`)
  console.log(`Numbers TKT-${String(rows[0]?.ticketNo).padStart(4, "0")} … TKT-${String(nextNo - 1).padStart(4, "0")}`)
  console.log("Status:", count((t) => t.status as string))
  console.log("Priority:", count((t) => t.priority as string))
  console.log("Assigned to:", count((t) => t.assignedTo))
  console.log(`Categories (${categorySpelling.size}):`, count((t) => t.category).slice(0, 15), "…")
  console.log("Sample:", rows.at(-1))

  if (!commit) {
    console.log("\nDry run: nothing was written. Add --commit to import.")
    return
  }

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    await prisma.$transaction(
      batch.map((ticket) =>
        prisma.ticket.upsert({
          where: { sourceId: ticket.sourceId },
          create: ticket,
          // Keep who it's assigned to: tickets the old system left with
          // "IT" or nobody were shared out between the IT Officers here.
          update: { ...ticket, assignedTo: undefined },
        }),
      ),
    )
    console.log(`Saved ${Math.min(i + 50, rows.length)} / ${rows.length}`)
  }

  // Numbers were set by hand, so move the counter past them.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"tickets"', 'ticketNo'), (SELECT MAX("ticketNo") FROM "tickets"))`,
  )
  console.log("Done.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
