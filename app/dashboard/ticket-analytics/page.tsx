import { TicketAnalyticsDashboard } from "@/components/ticket-analytics-dashboard"
import { listTickets } from "@/lib/ticket-repository"

export const dynamic = "force-dynamic"

export default async function TicketAnalyticsPage() {
  const tickets = await listTickets()
  return <TicketAnalyticsDashboard tickets={tickets} />
}
