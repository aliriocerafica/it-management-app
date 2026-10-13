import type { RequestPriority } from "@/lib/asset-requests";

// IT troubleshooting tickets: Open → In progress → Closed, then Archive.
export const ticketStatuses = [
  "Open",
  "In progress",
  "Closed",
  "Archived",
] as const;
export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketCategories = [
  "Hardware",
  "Software",
  "Network",
  "Account access",
  "Email",
  "Printer",
  "Other",
];

export type Ticket = {
  id: string;
  ticketNo: number;
  employeeId: string | null;
  requesterName: string;
  requesterEmail: string | null;
  department: string | null;
  // e.g. Hardware, Software, Network, Account access
  category: string;
  subject: string;
  description: string;
  priority: RequestPriority;
  status: TicketStatus;
  // The status an archived ticket had, so restoring puts it back there.
  archivedFrom?: TicketStatus | null;
  assignedTo: string | null;
  // What fixed it, or why it was closed without a fix.
  resolutionNote: string | null;
  // ISO timestamps
  createdAt: string;
  closedAt: string | null;
  // Resolution time entered by hand, for tickets closed later than they
  // were actually fixed. Null to use opened → closed.
  resolutionMinutes: number | null;
};

export function isOpenTicket(ticket: Pick<Ticket, "status">) {
  return ticket.status === "Open" || ticket.status === "In progress";
}

// Minutes a ticket took to resolve: the time entered by hand if there is
// one, otherwise from being opened to being closed. Null while it's still open.
export function resolutionMinutes(
  ticket: Pick<Ticket, "createdAt" | "closedAt" | "resolutionMinutes">,
) {
  if (!ticket.closedAt) return null;
  if (ticket.resolutionMinutes !== null) return ticket.resolutionMinutes;
  return Math.max(
    0,
    Math.round(
      (new Date(ticket.closedAt).getTime() -
        new Date(ticket.createdAt).getTime()) /
        60_000,
    ),
  );
}

// The resolution time in hours and minutes, e.g. "100 hrs 45 mins".
export function resolutionTime(
  ticket: Pick<Ticket, "createdAt" | "closedAt" | "resolutionMinutes">,
) {
  const minutes = resolutionMinutes(ticket);
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hrs = `${hours} ${hours === 1 ? "hr" : "hrs"}`;
  const mins = `${rest} ${rest === 1 ? "min" : "mins"}`;
  return hours === 0 ? mins : `${hrs} ${mins}`;
}

export function ticketCode(ticket: Pick<Ticket, "ticketNo">) {
  return `TKT-${String(ticket.ticketNo).padStart(4, "0")}`;
}

export const ticketStatusStyles: Record<
  TicketStatus,
  { dot: string; text: string }
> = {
  Open: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  "In progress": { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  Closed: {
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  Archived: {
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
};
