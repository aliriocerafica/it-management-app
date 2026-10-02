"use client";

import { useMemo, useState } from "react";
import {
  BoxIcon,
  CalendarClockIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleCheckIcon,
  CircleDotIcon,
  ClipboardListIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  FlagIcon,
  HashIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";

import {
  AssetRequestDialog,
  RequestDetailsDialog,
  RequestNoteDialog,
} from "@/components/asset-request-dialogs";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ErrorToast } from "@/components/error-toast";
import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table";
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
  requestCode,
  requestPriorities,
  requestStatusStyles,
  requestStatuses,
  type AssetRequest,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/asset-requests";
import {
  createAssetRequest,
  errorMessage,
  removeAssetRequests,
  saveAssetRequest,
} from "@/lib/inventory-api";
import { formatDate, initials, parseDate } from "@/lib/laptops";
import { usePendingSaves } from "@/lib/save-queue";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

type Tab = "All" | RequestStatus;
const tabs: Tab[] = ["All", ...requestStatuses];

// What each tab means, for the tab tooltips.
const tabHints: Record<Tab, string> = {
  All: "Every request",
  Pending: "Waiting for IT to approve or deny",
  Ongoing: "Approved, waiting to be handed over",
  Completed: "Handed over to the employee",
  Cancelled: "Denied or cancelled",
};

const open: RequestStatus[] = ["Pending", "Ongoing"];

function exportCsv(rows: AssetRequest[]) {
  const header = [
    "Request no.",
    "Requested by",
    "Employee ID",
    "Department",
    "Asset type",
    "Quantity",
    "Priority",
    "Reason",
    "Needed by",
    "Status",
    "Resolution note",
    "Requested",
    "Approved",
    "Completed",
    "Cancelled",
  ];
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const lines = rows.map((r) =>
    [
      requestCode(r),
      r.requesterName,
      r.employeeId ?? "",
      r.department ?? "",
      r.assetType,
      r.quantity,
      r.priority,
      r.reason,
      r.neededBy ?? "",
      r.status,
      r.resolutionNote ?? "",
      day(r.createdAt),
      day(r.approvedAt),
      day(r.completedAt),
      day(r.cancelledAt),
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
  link.download = "it-asset-requests.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function daysAgo(iso: string, today: Date) {
  const days = Math.floor(
    (today.getTime() - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function AssetRequestTable({
  initialData,
}: {
  initialData: AssetRequest[];
}) {
  const today = useToday();
  const [requests, setRequests] = useState(initialData);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AssetRequest | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRequest | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [denying, setDenying] = useState<AssetRequest | null>(null);
  const [completing, setCompleting] = useState<AssetRequest | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  // Approve / reopen ask first, since they change the request right away.
  const [confirming, setConfirming] = useState<{
    request: AssetRequest;
    action: "approve" | "reopen";
  } | null>(null);
  // The last change, and how to reverse it, for the Undo toast.
  const [undo, setUndo] = useState<{
    message: string;
    run: () => void;
  } | null>(null);
  const pendingSaves = usePendingSaves();

  const assetTypes = useMemo(
    () => [...new Set(requests.map((r) => r.assetType))].sort(),
    [requests],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (typeFilter.length && !typeFilter.includes(r.assetType)) return false;
      if (priorityFilter.length && !priorityFilter.includes(r.priority))
        return false;
      if (tab !== "All" && r.status !== tab) return false;
      if (!q) return true;
      return [
        requestCode(r),
        r.requesterName,
        r.employeeId ?? "",
        r.department ?? "",
        r.assetType,
        r.reason,
        r.resolutionNote ?? "",
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [requests, query, typeFilter, priorityFilter, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  const pageIds = pageRows.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage === pageIds.length;

  const hasFilters =
    query !== "" || typeFilter.length > 0 || priorityFilter.length > 0;

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = {
      All: requests.length,
      Pending: 0,
      Ongoing: 0,
      Completed: 0,
      Cancelled: 0,
    };
    for (const r of requests) counts[r.status] += 1;
    return counts;
  }, [requests]);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function openView(request: AssetRequest) {
    setViewing(request);
    setViewOpen(true);
  }

  function openEdit(request: AssetRequest) {
    if (!open.includes(request.status)) return;
    setEditing(request);
    setEditOpen(true);
  }

  // Background saves: the table updates right away, and if the database
  // rejects the change it's rolled back and the reason shown.
  function persist(save: Promise<unknown>, rollback?: () => void) {
    save.catch((error: unknown) => {
      rollback?.();
      setSaveError(errorMessage(error));
    });
  }

  // Puts a request back the way it was and saves that, for Undo.
  function revertRequest(original: AssetRequest) {
    const current = requests.find((r) => r.id === original.id);
    setRequests((prev) => prev.map((r) => (r.id === original.id ? original : r)));
    persist(saveAssetRequest(original), () =>
      current &&
      setRequests((prev) => prev.map((r) => (r.id === original.id ? current : r))),
    );
  }

  function updateRequest(
    id: string,
    update: (request: AssetRequest) => AssetRequest,
    message: string,
  ) {
    const original = requests.find((r) => r.id === id);
    if (!original) return;
    const next = update(original);
    setRequests((prev) => prev.map((r) => (r.id === id ? next : r)));
    persist(saveAssetRequest(next), () =>
      setRequests((prev) => prev.map((r) => (r.id === id ? original : r))),
    );
    setUndo({ message, run: () => revertRequest(original) });
  }

  function codeOf(id: string) {
    const request = requests.find((r) => r.id === id);
    return request ? requestCode(request) : "request";
  }

  function approve(id: string) {
    updateRequest(id, (r) => ({
      ...r,
      status: "Ongoing",
      approvedAt: new Date().toISOString(),
    }), `Approved ${codeOf(id)}`);
  }

  function complete(id: string, note: string) {
    updateRequest(id, (r) => ({
      ...r,
      status: "Completed",
      approvedAt: r.approvedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      resolutionNote: note || null,
    }), `Completed ${codeOf(id)}`);
    setCompleting(null);
  }

  function deny(id: string, reason: string) {
    updateRequest(id, (r) => ({
      ...r,
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      resolutionNote: reason,
    }), `${requests.find((r) => r.id === id)?.status === "Pending" ? "Denied" : "Cancelled"} ${codeOf(id)}`);
    setDenying(null);
  }

  // Puts a closed request back in the queue, clearing its decision.
  function reopen(id: string) {
    updateRequest(id, (r) => ({
      ...r,
      status: "Pending",
      approvedAt: null,
      completedAt: null,
      cancelledAt: null,
      resolutionNote: null,
    }), `Reopened ${codeOf(id)}`);
  }

  function deleteRequests(ids: string[]) {
    const removed = requests.filter((r) => ids.includes(r.id));
    const snapshot = requests;
    setUndo({
      message:
        removed.length === 1
          ? `Deleted ${requestCode(removed[0])}`
          : `Deleted ${removed.length} requests`,
      run: () => {
        setRequests(snapshot);
        const removedIds = new Set(removed.map((r) => r.id));
        persist(
          Promise.all(removed.map((r) => createAssetRequest(r))),
          () =>
            setRequests((prev) => prev.filter((r) => !removedIds.has(r.id))),
        );
      },
    });
    setRequests((prev) => prev.filter((r) => !ids.includes(r.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    persist(removeAssetRequests(ids), () => {
      setUndo(null);
      setRequests((prev) => [...removed, ...prev]);
    });
  }

  const pendingDelete = pendingDeleteIds
    .map((id) => requests.find((r) => r.id === id))
    .filter((r): r is AssetRequest => r != null);
  const deleteTitle =
    pendingDelete.length === 1
      ? "Delete request?"
      : `Delete ${pendingDelete.length} requests?`;
  const deleteDescription =
    pendingDelete.length === 1
      ? `Delete ${requestCode(pendingDelete[0])} (${pendingDelete[0].assetType} for ${pendingDelete[0].requesterName})? You can undo this afterward.`
      : `These ${pendingDelete.length} requests will be removed. You can undo this afterward.`;

  function clearFilters() {
    setQuery("");
    setTypeFilter([]);
    setPriorityFilter([]);
    setPage(1);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Folder tabs: the active tab joins the card below */}
      <div
        role="tablist"
        aria-label="Request status"
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
              {t === "All" ? (
                <ClipboardListIcon className="size-4" />
              ) : (
                <span
                  className={cn(
                    "size-2 rounded-full",
                    requestStatusStyles[t].dot,
                  )}
                />
              )}
              {t === "All" ? "All requests" : t}
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
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setPendingDeleteIds([...selected])}
              >
                <Trash2Icon />
                Delete
              </Button>
            </div>
          )}
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <FilterMenu
              label="Asset type"
              icon={BoxIcon}
              options={assetTypes}
              selected={typeFilter}
              onChange={(value) => {
                setTypeFilter(value);
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
                placeholder="Search requests"
                className="h-8 w-full pl-8 text-sm sm:w-48"
              />
            </div>
            <Button variant="outline" onClick={() => exportCsv(filtered)}>
              <DownloadIcon />
              Export
            </Button>
            <AssetRequestDialog
              onAdd={async (request) => {
                const saved = await createAssetRequest(request);
                setRequests((prev) => [saved, ...prev]);
                setTab("All");
                setPage(1);
                setUndo({
                  message: `Created ${requestCode(saved)}`,
                  run: () => {
                    setRequests((prev) => prev.filter((r) => r.id !== saved.id));
                    persist(removeAssetRequests([saved.id]), () =>
                      setRequests((prev) => [saved, ...prev]),
                    );
                  },
                });
              }}
            />
          </div>
        </div>

        {/* Table: rows scroll under a sticky header; columns drop out by priority as the card narrows */}
        <div className="@container max-h-[calc(100svh-17rem)] min-h-80 overflow-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 h-9 w-9 border-r border-border bg-card pl-3 shadow-[inset_0_-1px_0_var(--color-border)]">
                  <Checkbox
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                    onCheckedChange={(checked) => togglePage(checked)}
                  />
                </th>
                <ColumnHeader icon={HashIcon} className="hidden @3xl:table-cell">
                  Request
                </ColumnHeader>
                <ColumnHeader icon={UserIcon}>Requested by</ColumnHeader>
                <ColumnHeader icon={BoxIcon}>Asset</ColumnHeader>
                <ColumnHeader icon={FlagIcon} className="hidden @xl:table-cell">
                  Priority
                </ColumnHeader>
                <ColumnHeader
                  icon={CalendarClockIcon}
                  className="hidden @4xl:table-cell"
                >
                  Needed by
                </ColumnHeader>
                <ColumnHeader icon={CircleDotIcon}>Status</ColumnHeader>
                <th className="sticky top-0 z-10 h-9 min-w-34 bg-card px-2 text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((request) => {
                const isSelected = selected.has(request.id);
                const status = requestStatusStyles[request.status];
                const code = requestCode(request);
                const saving = pendingSaves.has(request.id);
                const overdue =
                  today != null &&
                  request.neededBy != null &&
                  open.includes(request.status) &&
                  parseDate(request.neededBy) < today;
                return (
                  <tr
                    key={request.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="w-9 border-r border-border pl-3">
                      <Checkbox
                        aria-label={`Select ${code}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleRow(request.id, checked)
                        }
                      />
                    </td>
                    <td className={cn(cellClass, "hidden @3xl:table-cell")}>
                      <div className="font-mono">{code}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {today
                          ? daysAgo(request.createdAt, today)
                          : formatDate(new Date(request.createdAt))}
                      </div>
                    </td>
                    <td className={cellClass}>
                      <div className="flex items-center gap-2">
                        <Avatar className="hidden size-6 after:rounded-full @2xl:flex">
                          <AvatarFallback className="bg-muted text-[9px] font-medium">
                            {initials(request.requesterName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="leading-tight">
                          <div>{request.requesterName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {request.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={cn(cellClass, "max-w-72 whitespace-normal")}>
                      <div className="font-medium">
                        {request.quantity > 1 && (
                          <span className="tabular-nums">
                            {request.quantity}×{" "}
                          </span>
                        )}
                        {request.assetType}
                        <span className="font-mono font-normal text-muted-foreground @3xl:hidden">
                          {" "}
                          · {code}
                        </span>
                      </div>
                      <div
                        className="line-clamp-1 text-[11px] text-muted-foreground"
                        title={request.reason}
                      >
                        {request.reason}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @xl:table-cell")}>
                      <span
                        className={cn(
                          "inline-flex rounded px-1.5 py-px text-[11px] font-medium",
                          priorityStyles[request.priority],
                        )}
                      >
                        {request.priority}
                      </span>
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "hidden tabular-nums @4xl:table-cell",
                      )}
                    >
                      {request.neededBy ? (
                        <div className="leading-tight">
                          <div>
                            {formatDate(parseDate(request.neededBy))}
                          </div>
                          {overdue && (
                            <div className="text-[11px] font-medium text-red-600 dark:text-red-400">
                              Overdue
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cellClass}>
                      {saving && (
                        <Loader2Icon
                          aria-label="Saving"
                          className="mr-1 inline size-3 animate-spin text-muted-foreground"
                        />
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                          status.text,
                        )}
                      >
                        <span
                          className={cn("size-1.5 rounded-full", status.dot)}
                        />
                        {request.status}
                      </span>
                      {request.resolutionNote && (
                        <div
                          className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground"
                          title={request.resolutionNote}
                        >
                          {request.resolutionNote}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {/* Same layout on every row: one primary action in a
                          fixed-width slot, everything else in the menu.
                          Locked while the row's last change is saving. */}
                      <fieldset
                        disabled={saving}
                        aria-busy={saving}
                        className="flex items-center justify-end gap-1 disabled:opacity-60"
                      >
                        {request.status === "Pending" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            onClick={() =>
                              setConfirming({ request, action: "approve" })
                            }
                          >
                            <CheckIcon />
                            Approve
                          </Button>
                        ) : request.status === "Ongoing" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            onClick={() => setCompleting(request)}
                          >
                            <CircleCheckIcon />
                            Complete
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="min-w-27 text-muted-foreground hover:text-foreground"
                            onClick={() => openView(request)}
                          >
                            <EyeIcon />
                            View
                          </Button>
                        )}
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
                            {open.includes(request.status) && (
                              <DropdownMenuItem
                                onClick={() => openView(request)}
                              >
                                <EyeIcon />
                                View details
                              </DropdownMenuItem>
                            )}
                            {open.includes(request.status) && (
                              <DropdownMenuItem onClick={() => openEdit(request)}>
                                <PencilIcon />
                                Edit request
                              </DropdownMenuItem>
                            )}
                            {open.includes(request.status) ? (
                              <DropdownMenuItem
                                onClick={() => setDenying(request)}
                              >
                                <XCircleIcon />
                                {request.status === "Pending"
                                  ? "Deny request"
                                  : "Cancel request"}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({ request, action: "reopen" })
                                }
                              >
                                <RotateCcwIcon />
                                Reopen as pending
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteIds([request.id])}
                            >
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </fieldset>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {requests.length === 0
                      ? "No requests yet. Log one with New request."
                      : "No requests match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

      <UndoToast
        message={undo?.message ?? null}
        onUndo={() => {
          undo?.run();
          setUndo(null);
        }}
        onDismiss={() => setUndo(null)}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteIds.length > 0}
        onOpenChange={(next) => {
          if (!next) setPendingDeleteIds([]);
        }}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel={
          pendingDelete.length === 1
            ? "Delete"
            : `Delete ${pendingDelete.length} requests`
        }
        onConfirm={() => deleteRequests(pendingDeleteIds)}
      />

      <ConfirmDeleteDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={
          confirming?.action === "approve"
            ? `Approve ${requestCode(confirming.request)}?`
            : `Reopen ${confirming ? requestCode(confirming.request) : ""}?`
        }
        description={
          !confirming
            ? ""
            : confirming.action === "approve"
              ? `${confirming.request.quantity > 1 ? `${confirming.request.quantity}× ` : ""}${confirming.request.assetType} for ${confirming.request.requesterName}. It moves to Ongoing until you mark it completed.`
              : `Move ${requestCode(confirming.request)} back to Pending? Its ${confirming.request.status === "Cancelled" ? "denial" : "completion"} and note will be cleared.`
        }
        confirmLabel={confirming?.action === "approve" ? "Approve" : "Reopen"}
        confirmVariant="default"
        icon={confirming?.action === "approve" ? CheckIcon : RotateCcwIcon}
        onConfirm={() => {
          if (!confirming) return;
          if (confirming.action === "approve") approve(confirming.request.id);
          else reopen(confirming.request.id);
        }}
      />

      <RequestNoteDialog
        request={denying}
        open={denying !== null}
        onOpenChange={(next) => !next && setDenying(null)}
        title={denying?.status === "Ongoing" ? "Cancel request" : "Deny request"}
        label="Reason"
        placeholder="e.g. No stock available; existing laptop still under warranty"
        required
        confirmLabel={
          denying?.status === "Ongoing" ? "Cancel request" : "Deny request"
        }
        confirmVariant="destructive"
        icon={XCircleIcon}
        onConfirm={(reason) => denying && deny(denying.id, reason)}
      />

      <RequestNoteDialog
        request={completing}
        open={completing !== null}
        onOpenChange={(next) => !next && setCompleting(null)}
        title="Complete request"
        label="What was handed over?"
        placeholder="e.g. Issued AR-LT-AU26-012 with charger"
        confirmLabel="Mark completed"
        icon={CircleCheckIcon}
        onConfirm={(note) => completing && complete(completing.id, note)}
      />

      <AssetRequestDialog
        request={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={async (next) => {
          const original = requests.find((r) => r.id === next.id);
          const saved = await saveAssetRequest(next);
          setRequests((prev) =>
            prev.map((r) => (r.id === saved.id ? saved : r)),
          );
          if (original) {
            setUndo({
              message: `Updated ${requestCode(saved)}`,
              run: () => revertRequest(original),
            });
          }
        }}
      />

      <ErrorToast message={saveError} onDismiss={() => setSaveError(null)} />

      <RequestDetailsDialog
        request={viewing}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />
    </div>
  );
}
