"use client";

import { useMemo, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarCheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleCheckIcon,
  CircleDotIcon,
  DownloadIcon,
  EllipsisIcon,
  FlagIcon,
  HashIcon,
  PlayIcon,
  RotateCcwIcon,
  SearchIcon,
  TagIcon,
  TimerIcon,
  Trash2Icon,
  UserCogIcon,
  UserIcon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { daysAgo } from "@/components/asset-request-table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DateRangeFilter } from "@/components/date-range-filter";
import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  rowClass,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table";
import { Scrollable } from "@/components/scrollable";
import { ResolutionTimeDialog, TicketDialog } from "@/components/ticket-dialog";
import { UndoToast } from "@/components/undo-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  priorityStyles,
  requestPriorities,
  type RequestPriority,
} from "@/lib/asset-requests";
import { anyInDateRange, type DateRange } from "@/lib/date-range";
import { formatDate, initials } from "@/lib/laptops";
import {
  isOpenTicket,
  resolutionTime,
  ticketCode,
  ticketStatusStyles,
  type Ticket,
  type TicketStatus,
} from "@/lib/tickets";
import { useServerState } from "@/lib/use-server-state";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

const tabs = ["Open", "Closed", "Archived"] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  Open: "Open Tickets",
  Closed: "Closed Tickets",
  Archived: "Archived",
};

// What each tab means, for the tab tooltips.
const tabHints: Record<Tab, string> = {
  Open: "Waiting on IT or being worked on",
  Closed: "Resolved or closed without a fix",
  Archived: "Tickets moved out of the queue",
};

const tabDots: Record<Tab, string> = {
  Open: ticketStatusStyles.Open.dot,
  Closed: ticketStatusStyles.Closed.dot,
  Archived: ticketStatusStyles.Archived.dot,
};

function tabOf(ticket: Ticket): Tab {
  if (ticket.status === "Archived") return "Archived";
  return isOpenTicket(ticket) ? "Open" : "Closed";
}

type TicketAction = "close" | "reopen" | "archive" | "restore";

// What each row action does to a ticket, and how it's worded.
const ticketActions: Record<
  TicketAction,
  {
    verb: string;
    done: string;
    icon: LucideIcon;
    apply: (ticket: Ticket) => Ticket;
    describe: string;
  }
> = {
  close: {
    verb: "Close",
    done: "Closed",
    icon: CircleCheckIcon,
    apply: (t) => ({
      ...t,
      status: "Closed",
      closedAt: new Date().toISOString(),
    }),
    describe: "moves to Closed Tickets",
  },
  reopen: {
    verb: "Reopen",
    done: "Reopened",
    icon: RotateCcwIcon,
    apply: (t) => ({
      ...t,
      status: "Open",
      closedAt: null,
      resolutionNote: null,
      resolutionMinutes: null,
    }),
    describe:
      "moves back to Open Tickets, and its closing date and note are cleared",
  },
  archive: {
    verb: "Archive",
    done: "Archived",
    icon: ArchiveIcon,
    apply: (t) => ({ ...t, status: "Archived", archivedFrom: t.status }),
    describe: "moves to Archived",
  },
  restore: {
    verb: "Restore",
    done: "Restored",
    icon: ArchiveRestoreIcon,
    // Back to wherever it was archived from.
    apply: (t) => ({
      ...t,
      status:
        t.archivedFrom && t.archivedFrom !== "Archived"
          ? t.archivedFrom
          : t.closedAt
            ? "Closed"
            : "Open",
      archivedFrom: null,
    }),
    describe: "moves back out of Archived",
  },
};

function exportCsv(rows: Ticket[], tab: Tab) {
  const header = [
    "Ticket no.",
    "Reported by",
    "Employee ID",
    "Email",
    "Department",
    "Category",
    "Subject",
    "Description",
    "Priority",
    "Assigned to",
    "Status",
    "Resolution note",
    "Opened",
    "Closed",
    "Resolution time",
  ];
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const lines = rows.map((t) =>
    [
      ticketCode(t),
      t.requesterName,
      t.employeeId ?? "",
      t.requesterEmail ?? "",
      t.department ?? "",
      t.category,
      t.subject,
      t.description,
      t.priority,
      t.assignedTo ?? "",
      t.status,
      t.resolutionNote ?? "",
      day(t.createdAt),
      day(t.closedAt),
      resolutionTime(t) ?? "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `it-troubleshooting-tickets-${tab.toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function TicketTable({
  initialData,
  canDelete = false,
}: {
  initialData: Ticket[];
  // Only admins can permanently delete an archived ticket.
  canDelete?: boolean;
}) {
  const today = useToday();
  const [tickets, setTickets] = useServerState(initialData);
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority[]>([]);
  const [tab, setTab] = useState<Tab>("Open");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [page, setPage] = useState(1);
  // Close / reopen / archive / restore ask first.
  const [confirming, setConfirming] = useState<{
    tickets: Ticket[];
    action: TicketAction;
  } | null>(null);
  const [editingTime, setEditingTime] = useState<Ticket | null>(null);
  // The ticket being closed, while choosing how its resolution time is set.
  const [closing, setClosing] = useState<Ticket | null>(null);
  // Archived tickets about to be permanently deleted.
  const [pendingDelete, setPendingDelete] = useState<Ticket[]>([]);
  // The last change, and how to reverse it, for the Undo toast.
  const [undo, setUndo] = useState<{
    message: string;
    run: () => void;
  } | null>(null);

  const categories = useMemo(
    () => [...new Set(tickets.map((t) => t.category))].sort(),
    [tickets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (tabOf(t) !== tab) return false;
      if (categoryFilter.length && !categoryFilter.includes(t.category))
        return false;
      if (priorityFilter.length && !priorityFilter.includes(t.priority))
        return false;
      // Opened or closed inside the range.
      if (!anyInDateRange([t.createdAt, t.closedAt], dateRange)) return false;
      if (!q) return true;
      return [
        ticketCode(t),
        t.requesterName,
        t.employeeId ?? "",
        t.department ?? "",
        t.requesterEmail ?? "",
        t.category,
        t.subject,
        t.description,
        t.assignedTo ?? "",
        t.resolutionNote ?? "",
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [tickets, query, categoryFilter, priorityFilter, dateRange, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  const filteredIds = filtered.map((t) => t.id);
  const selectedInView = filteredIds.filter((id) => selected.has(id)).length;
  const allSelected =
    filteredIds.length > 0 && selectedInView === filteredIds.length;

  const hasFilters =
    query !== "" ||
    categoryFilter.length > 0 ||
    priorityFilter.length > 0 ||
    dateRange !== null;

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { Open: 0, Closed: 0, Archived: 0 };
    for (const t of tickets) counts[tabOf(t)] += 1;
    return counts;
  }, [tickets]);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const selectedTickets = tickets.filter((t) => selected.has(t.id));
  const selectedOpen = selectedTickets.filter(isOpenTicket);
  const selectedArchivable = selectedTickets.filter(
    (t) => t.status !== "Archived",
  );

  const selectedArchived = selectedTickets.filter(
    (t) => t.status === "Archived",
  );

  function deleteTickets(removed: Ticket[]) {
    const removedIds = new Set(removed.map((t) => t.id));
    const snapshot = tickets;
    setTickets((prev) => prev.filter((t) => !removedIds.has(t.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of removedIds) next.delete(id);
      return next;
    });
    setUndo({
      message:
        removed.length === 1
          ? `Deleted ${ticketCode(removed[0])}`
          : `Deleted ${removed.length} tickets`,
      run: () => setTickets(snapshot),
    });
  }

  function replaceTickets(next: Ticket[]) {
    const byId = new Map(next.map((t) => [t.id, t]));
    setTickets((prev) => prev.map((t) => byId.get(t.id) ?? t));
  }

  function runAction(originals: Ticket[], action: TicketAction) {
    const { apply, done } = ticketActions[action];
    replaceTickets(originals.map(apply));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of originals) next.delete(t.id);
      return next;
    });
    setUndo({
      message:
        originals.length === 1
          ? `${done} ${ticketCode(originals[0])}`
          : `${done} ${originals.length} tickets`,
      run: () => replaceTickets(originals),
    });
  }

  function setStatus(ticket: Ticket, status: TicketStatus) {
    replaceTickets([{ ...ticket, status }]);
    setUndo({
      message: `Marked ${ticketCode(ticket)} as ${status.toLowerCase()}`,
      run: () => replaceTickets([ticket]),
    });
  }

  function clearFilters() {
    setQuery("");
    setCategoryFilter([]);
    setPriorityFilter([]);
    setDateRange(null);
    setPage(1);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Folder tabs: the active tab joins the card below */}
      <div
        role="tablist"
        aria-label="Ticket status"
        className="flex items-end gap-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              title={tabHints[t]}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "z-10 -mb-px h-10 border-border bg-card pb-px text-foreground"
                  : "h-9 border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className={cn("size-2 rounded-full", tabDots[t])} />
              {tabLabels[t]}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active
                    ? "bg-foreground text-background"
                    : "bg-background/70 text-muted-foreground",
                )}
              >
                {tabCounts[t]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col rounded-2xl rounded-tl-none border border-border bg-card text-card-foreground shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {selected.size} selected
              </span>
              {selectedOpen.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    selectedOpen.length === 1
                      ? setClosing(selectedOpen[0])
                      : setConfirming({
                          tickets: selectedOpen,
                          action: "close",
                        })
                  }
                >
                  <CircleCheckIcon />
                  {selectedOpen.length === 1
                    ? "Close"
                    : `Close ${selectedOpen.length}`}
                </Button>
              )}
              {selectedArchivable.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setConfirming({
                      tickets: selectedArchivable,
                      action: "archive",
                    })
                  }
                >
                  <ArchiveIcon />
                  {selectedArchivable.length === 1
                    ? "Archive"
                    : `Archive ${selectedArchivable.length}`}
                </Button>
              )}
              {canDelete && selectedArchived.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setPendingDelete(selectedArchived)}
                >
                  <Trash2Icon />
                  {selectedArchived.length === 1
                    ? "Delete"
                    : `Delete ${selectedArchived.length}`}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <FilterMenu
              label="Category"
              icon={TagIcon}
              options={categories}
              selected={categoryFilter}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
            />
            <FilterMenu
              label="Priority"
              icon={FlagIcon}
              options={[...requestPriorities]}
              selected={priorityFilter}
              onChange={(value) => {
                setPriorityFilter(value);
                setPage(1);
              }}
            />
            <DateRangeFilter
              label="Activity"
              value={dateRange}
              onChange={(value) => {
                setDateRange(value);
                setPage(1);
              }}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon />
                Clear
              </Button>
            )}
            <div className="relative flex-1 sm:flex-none">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search tickets"
                className="h-8 w-full pl-8 text-sm sm:w-48"
              />
            </div>
            <Button variant="outline" onClick={() => exportCsv(filtered, tab)}>
              <DownloadIcon />
              Export
            </Button>
            <TicketDialog
              onAdd={(ticket) => {
                // Nothing stores tickets yet, so the number is assigned here.
                setTickets((prev) => [
                  {
                    ...ticket,
                    ticketNo: Math.max(0, ...prev.map((t) => t.ticketNo)) + 1,
                  },
                  ...prev,
                ]);
                setTab("Open");
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Table: rows scroll under a sticky header; columns drop out by priority as the card narrows */}
        <Scrollable className="@container max-h-[calc(100svh-17rem)] min-h-80">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 h-9 w-10 border-r border-border bg-card px-3 shadow-[inset_0_-1px_0_var(--color-border)]">
                  <Checkbox
                    aria-label={
                      filtered.length === 0
                        ? "Select all"
                        : `Select all ${filtered.length} tickets`
                    }
                    checked={allSelected}
                    disabled={filteredIds.length === 0}
                    indeterminate={selectedInView > 0 && !allSelected}
                    onCheckedChange={(checked) => toggleAll(checked)}
                  />
                </th>
                <ColumnHeader
                  icon={HashIcon}
                  className="hidden @3xl:table-cell"
                >
                  Ticket
                </ColumnHeader>
                <ColumnHeader icon={UserIcon}>Reported by</ColumnHeader>
                <ColumnHeader icon={WrenchIcon}>Issue</ColumnHeader>
                <ColumnHeader icon={FlagIcon} className="hidden @xl:table-cell">
                  Priority
                </ColumnHeader>
                <ColumnHeader
                  icon={UserCogIcon}
                  className="hidden @2xl:table-cell"
                >
                  Assigned to
                </ColumnHeader>
                {tab !== "Open" && (
                  <ColumnHeader
                    icon={CalendarCheckIcon}
                    className="hidden @4xl:table-cell"
                  >
                    Closed
                  </ColumnHeader>
                )}
                <ColumnHeader icon={CircleDotIcon}>Status</ColumnHeader>
                <th className="sticky top-0 z-10 h-9 min-w-34 bg-card px-2 text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((ticket) => {
                const status = ticketStatusStyles[ticket.status];
                const code = ticketCode(ticket);
                const isSelected = selected.has(ticket.id);
                const primary: TicketAction = isOpenTicket(ticket)
                  ? "close"
                  : ticket.status === "Closed"
                    ? "archive"
                    : "restore";
                const PrimaryIcon = ticketActions[primary].icon;
                const isActive =
                  closing?.id === ticket.id ||
                  editingTime?.id === ticket.id ||
                  (confirming?.tickets.length === 1 &&
                    confirming.tickets[0].id === ticket.id) ||
                  (pendingDelete.length === 1 &&
                    pendingDelete[0].id === ticket.id);
                return (
                  <tr
                    key={ticket.id}
                    data-state={isSelected ? "selected" : undefined}
                    data-active={isActive || undefined}
                    // Tinted green while its actions menu, or a dialog
                    // opened from it, is up.
                    className={rowClass}
                  >
                    <td className="w-10 border-r border-border px-3">
                      <Checkbox
                        aria-label={`Select ${code}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleRow(ticket.id, checked)
                        }
                      />
                    </td>
                    <td className={cn(cellClass, "hidden @3xl:table-cell")}>
                      <div className="font-mono">{code}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {today
                          ? daysAgo(ticket.createdAt, today)
                          : formatDate(new Date(ticket.createdAt))}
                      </div>
                    </td>
                    <td className={cellClass}>
                      <div className="flex items-center gap-2">
                        <Avatar className="hidden size-6 after:rounded-full @2xl:flex">
                          <AvatarFallback className="bg-muted text-[9px] font-medium">
                            {initials(ticket.requesterName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="leading-tight">
                          <div>{ticket.requesterName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {ticket.requesterEmail || ticket.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={cn(cellClass, "max-w-72 whitespace-normal")}>
                      <div className="font-medium">
                        {ticket.subject}
                        <span className="font-mono font-normal text-muted-foreground @3xl:hidden">
                          {" "}
                          · {code}
                        </span>
                      </div>
                      <div
                        className="line-clamp-1 text-[11px] text-muted-foreground"
                        title={ticket.description}
                      >
                        {ticket.category}
                        {ticket.description && ` · ${ticket.description}`}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @xl:table-cell")}>
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-px text-[11px] font-medium",
                          priorityStyles[ticket.priority],
                        )}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className={cn(cellClass, "hidden @2xl:table-cell")}>
                      {ticket.assignedTo ?? (
                        <span className="text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </td>
                    {tab !== "Open" && (
                      <td
                        className={cn(
                          cellClass,
                          "hidden tabular-nums @4xl:table-cell",
                        )}
                      >
                        {ticket.closedAt ? (
                          <div className="leading-tight">
                            <div>{formatDate(new Date(ticket.closedAt))}</div>
                            <div className="text-[11px] text-muted-foreground">
                              Resolved in{" "}
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {resolutionTime(ticket)}
                              </span>
                              {ticket.resolutionMinutes !== null && " · edited"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className={cellClass}>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                          status.text,
                        )}
                      >
                        <span
                          className={cn("size-1.5 rounded-full", status.dot)}
                        />
                        {ticket.status}
                      </span>
                      {ticket.resolutionNote && (
                        <div
                          className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground"
                          title={ticket.resolutionNote}
                        >
                          {ticket.resolutionNote}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {/* Same layout on every row: one primary action in a
                          fixed-width slot, everything else in the menu. */}
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="xs"
                          className="min-w-27"
                          onClick={() =>
                            primary === "close"
                              ? setClosing(ticket)
                              : setConfirming({
                                  tickets: [ticket],
                                  action: primary,
                                })
                          }
                        >
                          <PrimaryIcon />
                          {ticketActions[primary].verb}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`More actions for ${code}`}
                                className="text-muted-foreground hover:text-foreground"
                              />
                            }
                          >
                            <EllipsisIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Only what the row's main button doesn't already do. */}
                            {ticket.status === "Open" && (
                              <DropdownMenuItem
                                onClick={() => setStatus(ticket, "In progress")}
                              >
                                <PlayIcon />
                                Mark in progress
                              </DropdownMenuItem>
                            )}
                            {ticket.status === "In progress" && (
                              <DropdownMenuItem
                                onClick={() => setStatus(ticket, "Open")}
                              >
                                <RotateCcwIcon />
                                Back to open
                              </DropdownMenuItem>
                            )}
                            {isOpenTicket(ticket) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({
                                    tickets: [ticket],
                                    action: "archive",
                                  })
                                }
                              >
                                <ArchiveIcon />
                                Archive
                              </DropdownMenuItem>
                            )}
                            {ticket.closedAt && (
                              <DropdownMenuItem
                                onClick={() => setEditingTime(ticket)}
                              >
                                <TimerIcon />
                                Edit resolution time
                              </DropdownMenuItem>
                            )}
                            {!isOpenTicket(ticket) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({
                                    tickets: [ticket],
                                    action: "reopen",
                                  })
                                }
                              >
                                <RotateCcwIcon />
                                Reopen ticket
                              </DropdownMenuItem>
                            )}
                            {canDelete && ticket.status === "Archived" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setPendingDelete([ticket])}
                                >
                                  <Trash2Icon />
                                  Delete permanently
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={tab === "Open" ? 8 : 9}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {tabCounts[tab] === 0
                      ? `No ${tab.toLowerCase()} tickets.`
                      : "No tickets match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Scrollable>

        {/* Pagination */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="w-16" />}
            >
              {rowsPerPage}
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-20">
              <DropdownMenuRadioGroup
                value={rowsPerPage}
                onValueChange={(value) => {
                  setRowsPerPage(value as number);
                  setPage(1);
                }}
              >
                {rowsPerPageOptions.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {option}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="tabular-nums">
            {filtered.length === 0
              ? "0 rows"
              : `${start + 1}–${start + pageRows.length} of ${filtered.length} rows`}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="First page"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                variant={n === currentPage ? "secondary" : "ghost"}
                size="icon-sm"
                className={cn(n === currentPage && "text-foreground")}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Last page"
              disabled={currentPage === pageCount}
              onClick={() => setPage(pageCount)}
            >
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={
          !confirming
            ? ""
            : confirming.tickets.length === 1
              ? `${ticketActions[confirming.action].verb} ${ticketCode(confirming.tickets[0])}?`
              : `${ticketActions[confirming.action].verb} ${confirming.tickets.length} tickets?`
        }
        description={
          !confirming
            ? ""
            : confirming.tickets.length === 1
              ? `"${confirming.tickets[0].subject}" for ${confirming.tickets[0].requesterName} ${ticketActions[confirming.action].describe}. You can undo this afterward.`
              : `Each of these ${confirming.tickets.length} tickets ${ticketActions[confirming.action].describe}. You can undo this afterward.`
        }
        confirmLabel={
          !confirming
            ? ""
            : confirming.tickets.length === 1
              ? ticketActions[confirming.action].verb
              : `${ticketActions[confirming.action].verb} ${confirming.tickets.length}`
        }
        confirmVariant="default"
        icon={confirming ? ticketActions[confirming.action].icon : undefined}
        onConfirm={() => {
          if (confirming) runAction(confirming.tickets, confirming.action);
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete.length > 0}
        onOpenChange={(next) => !next && setPendingDelete([])}
        title={
          pendingDelete.length === 1
            ? `Permanently delete ${ticketCode(pendingDelete[0])}?`
            : `Permanently delete ${pendingDelete.length} tickets?`
        }
        description={
          pendingDelete.length === 1
            ? `"${pendingDelete[0].subject}" for ${pendingDelete[0].requesterName} will be removed for good, not just archived. You can undo this only right afterward.`
            : `These ${pendingDelete.length} archived tickets will be removed for good. You can undo this only right afterward.`
        }
        confirmLabel={
          pendingDelete.length === 1
            ? "Delete permanently"
            : `Delete ${pendingDelete.length} tickets`
        }
        onConfirm={() => deleteTickets(pendingDelete)}
      />

      <ResolutionTimeDialog
        ticket={editingTime}
        open={editingTime !== null}
        onOpenChange={(next) => !next && setEditingTime(null)}
        onSave={(edit) => {
          if (!editingTime) return;
          const original = editingTime;
          const next = { ...original, ...edit };
          setEditingTime(null);
          replaceTickets([next]);
          setUndo({
            message: `Updated ${ticketCode(original)}: resolved in ${resolutionTime(next)}`,
            run: () => replaceTickets([original]),
          });
        }}
      />

      <ResolutionTimeDialog
        closing
        ticket={closing}
        open={closing !== null}
        onOpenChange={(next) => !next && setClosing(null)}
        onSave={(edit) => {
          if (!closing) return;
          const original = closing;
          const next: Ticket = { ...original, ...edit, status: "Closed" };
          setClosing(null);
          replaceTickets([next]);
          setSelected((prev) => {
            const rest = new Set(prev);
            rest.delete(original.id);
            return rest;
          });
          setUndo({
            message: `Closed ${ticketCode(original)}: resolved in ${resolutionTime(next)}`,
            run: () => replaceTickets([original]),
          });
        }}
      />

      <UndoToast
        message={undo?.message ?? null}
        onUndo={() => {
          undo?.run();
          setUndo(null);
        }}
        onDismiss={() => setUndo(null)}
      />
    </div>
  );
}
