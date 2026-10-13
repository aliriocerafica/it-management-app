import { TicketTable } from "@/components/ticket-table"
import { verifySession } from "@/lib/auth/session"
import type { Ticket } from "@/lib/tickets"

// Test tickets to show the layout until a real ticket source is connected.
const testTickets: Ticket[] = [
  {
    id: "test-ticket-3",
    ticketNo: 3,
    employeeId: "TEST-003",
    requesterName: "Test Employee Three",
    requesterEmail: "test.three@example.com",
    department: "Operations",
    category: "Network",
    subject: "Wi-Fi keeps disconnecting",
    description: "Connection drops every few minutes during video calls.",
    priority: "Urgent",
    status: "Open",
    assignedTo: null,
    resolutionNote: null,
    createdAt: "2026-10-12T01:30:00.000Z",
    closedAt: null,
    resolutionMinutes: null,
  },
  {
    id: "test-ticket-2",
    ticketNo: 2,
    employeeId: "TEST-002",
    requesterName: "Test Employee Two",
    requesterEmail: "test.two@example.com",
    department: "Finance",
    category: "Software",
    subject: "Outlook won't open",
    description: "Stuck on the loading profile screen since this morning.",
    priority: "Normal",
    status: "In progress",
    assignedTo: "IT Support",
    resolutionNote: null,
    createdAt: "2026-10-09T03:15:00.000Z",
    closedAt: null,
    resolutionMinutes: null,
  },
  {
    id: "test-ticket-1",
    ticketNo: 1,
    employeeId: "TEST-001",
    requesterName: "Test Employee One",
    requesterEmail: "test.one@example.com",
    department: "Human Resources",
    category: "Hardware",
    subject: "Laptop battery drains quickly",
    description: "Lasts under an hour on a full charge.",
    priority: "High",
    status: "Closed",
    assignedTo: "IT Support",
    resolutionNote: "Replaced the battery.",
    createdAt: "2026-10-01T02:00:00.000Z",
    closedAt: "2026-10-05T06:45:00.000Z",
    resolutionMinutes: null,
  },
]

export const dynamic = "force-dynamic"

export default async function TroubleshootingTicketsPage() {
  const tickets = testTickets
  const user = await verifySession()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        IT Troubleshooting Tickets
      </h1>
      <TicketTable
        initialData={tickets}
        canDelete={user?.role === "ADMIN"}
      />
    </div>
  )
}
