import { TicketIcon } from "lucide-react"

export default function TicketsPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Tickets
      </h1>
      <p className="text-sm text-muted-foreground">
        Manage support requests and issues.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
        <TicketIcon className="size-8 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No tickets yet</p>
          <p className="text-sm text-muted-foreground">
            Support requests and issues will show up here once submitted.
          </p>
        </div>
      </div>
    </div>
  )
}
