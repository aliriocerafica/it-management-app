import type { RequestPriority } from "@/lib/asset-requests";

// IT troubleshooting tickets: Open → In progress → Closed, then Archive.
export const ticketStatuses = [
  "Open",
  "In progress",
  "Closed",
  "Archived",
] as const;
export type TicketStatus = (typeof ticketStatuses)[number];

// Categories a ticket is filed under. Tickets imported from the old system
// keep its free-text types ("Laptop Release and Setup", "Box Crashing", …);
// ticketCategoryGroup() files those under one of these.
export const ticketCategories = [
  "Account & access",
  "Laptop release & setup",
  "Hardware & repairs",
  "Peripherals",
  "Software & apps",
  "Email & communication",
  "Cloud storage",
  "Network & VPN",
  "DTR & AURA",
  "Printing",
  "Other",
];

// Checked in order against a type's first part; the first match wins.
const categoryRules: [RegExp, string][] = [
  [/dtr|aura|location|geo|biometric|leave adjustment|coa|clock out|dashboard|data track|ardent track|^beta/, "DTR & AURA"],
  [/vpn|hotspot|network|wifi|router|internet/, "Network & VPN"],
  [/print/, "Printing"],
  [/dropbox|\bbox\b|egnyte|one ?drive|share link/, "Cloud storage"],
  [/account|password|passkey|security|restriction|auth/, "Account & access"],
  [/ms office|ms word|microsoft|outlook|one note|email|ring central|^rc\b|slack|communication|meeting|teams/, "Email & communication"],
  [/peripheral|monitor|charger|headset|headphone|\bmic\b|speaker|keyboard|mouse|camera|steel ?series|touch?pad|toucpad|battery|numpad|volume|brightness/, "Peripherals"],
  [/laptop release|laptop set-?up|format|turn ?over|onboarding|device release|phone release/, "Laptop release & setup"],
  [/hardware|hadrware|device|repair|\bram\b|screen|screw|cleaning|audit|incident|audio|lag|performance/, "Hardware & repairs"],
  [/app|software|adobe|nitro|pdf|chrome|grammarly|krisp|activetrak|file explore|anydesk|rdp|remote desktop|salesforce|filevine|paint|install|noise/, "Software & apps"],
];

export function ticketCategoryGroup(category: string) {
  if (ticketCategories.includes(category)) return category;
  const first = category.split(",")[0].trim().toLowerCase();
  return categoryRules.find(([rule]) => rule.test(first))?.[1] ?? "Other";
}

export type Ticket = {
  id: string;
  ticketNo: number;
  employeeId: string | null;
  requesterName: string;
  requesterEmail: string | null;
  department: string | null;
  // Onsite or WFH, when known.
  workLocation?: string | null;
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
  // Employee feedback, on tickets imported from the old log.
  satisfaction?: string | null;
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
  return minutes === null ? null : formatMinutes(minutes);
}

// A duration in hours and minutes, e.g. "100 hrs 45 mins".
export function formatMinutes(total: number) {
  const minutes = Math.round(total);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hrs = `${hours} ${hours === 1 ? "hr" : "hrs"}`;
  const mins = `${rest} ${rest === 1 ? "min" : "mins"}`;
  return hours === 0 ? mins : `${hrs} ${mins}`;
}

// A name typed in all capitals, in normal case: "ALEJANDRO CERAFICA JR." →
// "Alejandro Cerafica Jr.". Names with any lowercase, and single words like
// "IT", are left as typed.
export function personName(name: string) {
  if (name !== name.toUpperCase() || !/\s/.test(name.trim())) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s.'-])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());
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
