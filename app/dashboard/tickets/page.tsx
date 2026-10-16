import { TicketTable } from "@/components/ticket-table"
import { getAccountabilityFormSettings } from "@/lib/accountability-form-settings"
import { verifySession } from "@/lib/auth/session"
import { listTickets } from "@/lib/ticket-repository"
import { personName } from "@/lib/tickets"

export const dynamic = "force-dynamic"

export default async function TroubleshootingTicketsPage() {
  const [tickets, settings, user] = await Promise.all([
    listTickets(),
    getAccountabilityFormSettings(),
    verifySession(),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        IT Troubleshooting Tickets
      </h1>
      <TicketTable
        initialData={tickets}
        // Tickets go to the IT Officers listed in the accountability form
        // settings.
        itOfficers={settings.itOfficers.map((officer) =>
          personName(officer.name),
        )}
        canDelete={user?.role === "ADMIN"}
      />
    </div>
  )
}
