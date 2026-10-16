import type { RequestPriority } from "@/lib/asset-requests"
import type {
  AssetRequestPriority,
  Ticket as TicketRow,
  TicketStatus as TicketStatusDb,
} from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import type { Ticket, TicketStatus } from "@/lib/tickets"

export const statusToDb: Record<TicketStatus, TicketStatusDb> = {
  Open: "OPEN",
  "In progress": "IN_PROGRESS",
  Closed: "CLOSED",
  Archived: "ARCHIVED",
}

const statusFromDb = Object.fromEntries(
  Object.entries(statusToDb).map(([label, value]) => [value, label]),
) as Record<TicketStatusDb, TicketStatus>

export const priorityToDb: Record<RequestPriority, AssetRequestPriority> = {
  Low: "LOW",
  Normal: "NORMAL",
  High: "HIGH",
  Urgent: "URGENT",
}

const priorityFromDb = Object.fromEntries(
  Object.entries(priorityToDb).map(([label, value]) => [value, label]),
) as Record<AssetRequestPriority, RequestPriority>

function ticketFromDb(row: TicketRow): Ticket {
  return {
    id: row.id,
    ticketNo: row.ticketNo,
    employeeId: row.employeeId,
    requesterName: row.requesterName,
    requesterEmail: row.requesterEmail,
    department: row.department,
    workLocation: row.workLocation,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: priorityFromDb[row.priority],
    status: statusFromDb[row.status],
    archivedFrom: row.archivedFrom ? statusFromDb[row.archivedFrom] : null,
    assignedTo: row.assignedTo,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    resolutionMinutes: row.resolutionMinutes,
    satisfaction: row.satisfaction,
  }
}

function ticketData(ticket: Ticket) {
  return {
    employeeId: ticket.employeeId || null,
    requesterName: ticket.requesterName.trim(),
    requesterEmail: ticket.requesterEmail?.trim() || null,
    department: ticket.department?.trim() || null,
    workLocation: ticket.workLocation?.trim() || null,
    category: ticket.category.trim(),
    subject: ticket.subject.trim(),
    description: ticket.description?.trim() ?? "",
    priority: priorityToDb[ticket.priority] ?? "NORMAL",
    status: statusToDb[ticket.status] ?? "OPEN",
    archivedFrom: ticket.archivedFrom ? statusToDb[ticket.archivedFrom] : null,
    assignedTo: ticket.assignedTo?.trim() || null,
    resolutionNote: ticket.resolutionNote?.trim() || null,
    createdAt: new Date(ticket.createdAt),
    closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
    resolutionMinutes: ticket.resolutionMinutes,
  }
}

export async function listTickets(): Promise<Ticket[]> {
  const rows = await prisma.ticket.findMany({ orderBy: { createdAt: "desc" } })
  return rows.map(ticketFromDb)
}

// Restoring a deleted ticket (undo) passes its old id and number back in so
// it comes back unchanged.
export async function createTicket(ticket: Ticket): Promise<Ticket> {
  const restoring = ticket.ticketNo > 0
  const row = await prisma.ticket.create({
    data: {
      ...ticketData(ticket),
      ...(restoring && { id: ticket.id, ticketNo: ticket.ticketNo }),
    },
  })
  return ticketFromDb(row)
}

export async function updateTicket(ticket: Ticket): Promise<Ticket> {
  const row = await prisma.ticket.update({
    where: { id: ticket.id },
    data: ticketData(ticket),
  })
  return ticketFromDb(row)
}

export async function deleteTickets(ids: string[]) {
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } })
}
