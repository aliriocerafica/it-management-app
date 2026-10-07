"use client";

import { useMemo, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
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
  IssueDtrAssetDialog,
  RequestDetailsDialog,
  RequestNoteDialog,
  ReturnDtrAssetDialog,
} from "@/components/asset-request-dialogs";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ErrorToast } from "@/components/error-toast";
import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table";
import { Scrollable } from "@/components/scrollable";
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
  archiveableStatuses,
  openRequestStatuses,
  previousStatusAfterUnarchive,
  priorityStyles,
  requestCode,
  requestPriorities,
  requestStatusStyles,
  requestStatuses,
  type AssetRequest,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/asset-requests";
import type { DtrIssueCondition, DtrReturnCondition } from "@/lib/dtr";
import {
  approveDtrAsset,
  archiveExternalAssetRequest,
  createAssetRequest,
  errorMessage,
  issueDtrAsset,
  rejectDtrAsset,
  removeAssetRequests,
  returnDtrAsset,
  saveAssetRequest,
  saveExternalRequestOverride,
  unarchiveExternalAssetRequest,
} from "@/lib/inventory-api";
import { formatDate, initials, parseDate } from "@/lib/laptops";
import { usePendingSaves } from "@/lib/save-queue";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

type Tab = "All" | RequestStatus;
const tabs: Tab[] = ["All", ...requestStatuses];

// What each tab means, for the tab tooltips.
const tabHints: Record<Tab, string> = {
  All: "Active requests, not archived",
  Pending: "Waiting for IT to approve or deny",
  Approved: "Approved, waiting to be handed over",
  Completed: "Handed over to the employee",
  Denied: "Denied or cancelled",
  Archived: "Closed requests moved out of the queue",
};

function exportCsv(rows: AssetRequest[]) {
  const header = [
    "Request no.",
    "Requested by",
    "Employee ID",
    "Email",
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
    "Denied",
  ];
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const lines = rows.map((r) =>
    [
      requestCode(r),
      r.requesterName,
      r.employeeId ?? "",
      r.requesterEmail ?? "",
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
  const [returning, setReturning] = useState<AssetRequest | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  // Approve / reopen ask first, since they change the request right away.
  const [confirming, setConfirming] = useState<{
    request: AssetRequest;
    action:
      | "approve"
      | "reopen"
      | "archive"
      | "unarchive"
      | "deny"
      | "complete"
      | "edit";
    next?: AssetRequest;
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
      if (tab === "All" && r.status === "Archived") return false;
      if (tab !== "All" && r.status !== tab) return false;
      if (!q) return true;
      return [
        requestCode(r),
        r.requesterName,
        r.employeeId ?? "",
        r.department ?? "",
        r.requesterEmail ?? "",
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
  const selectablePageIds = pageRows
    .filter((r) => r.source !== "dtr")
    .map((r) => r.id);
  const selectedOnPage = selectablePageIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected =
    selectablePageIds.length > 0 &&
    selectedOnPage === selectablePageIds.length;

  const hasFilters =
    query !== "" || typeFilter.length > 0 || priorityFilter.length > 0;

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = {
      All: 0,
      Pending: 0,
      Approved: 0,
      Completed: 0,
      Denied: 0,
      Archived: 0,
    };
    for (const r of requests) {
      counts[r.status] += 1;
      if (r.status !== "Archived") counts.All += 1;
    }
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
      for (const id of selectablePageIds) {
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
    if (!openRequestStatuses.includes(request.status)) return;
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
    setRequest(original.id, original);
    const undoSave =
      original.source === "dtr"
        ? original.status === "Archived"
          ? archiveExternalAssetRequest(original.id)
          : saveExternalRequestOverride(
              original.id,
              original.status,
              original.resolutionNote,
            )
        : saveAssetRequest(original);
    persist(undoSave, () => current && setRequest(original.id, current));
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

  function applyEdit(original: AssetRequest, next: AssetRequest) {
    setEditOpen(false);
    setRequest(original.id, next);
    persist(
      saveAssetRequest(next).then((saved) => replaceRequest(saved)),
      () => setRequest(original.id, original),
    );
    setUndo({
      message: `Updated ${requestCode(original)}`,
      run: () => revertRequest(original),
    });
  }

  function codeOf(id: string) {
    const request = requests.find((r) => r.id === id);
    return request ? requestCode(request) : "request";
  }

  function setRequest(id: string, next: AssetRequest) {
    setRequests((prev) => prev.map((r) => (r.id === id ? next : r)));
  }

  function approve(id: string) {
    const original = requests.find((r) => r.id === id);
    if (!original) return;
    const next: AssetRequest = {
      ...original,
      status: "Approved",
      approvedAt: new Date().toISOString(),
      resolutionNote: original.source === "dtr" ? null : original.resolutionNote,
    };
    if (original.source === "dtr") {
      setRequest(id, next);
      persist(approveDtrAsset(id).then(replaceRequest), () => setRequest(id, original));
      setUndo({
        message: `Approved ${codeOf(id)}`,
        run: () => revertRequest(original),
      });
      return;
    }
    updateRequest(id, () => next, `Approved ${codeOf(id)}`);
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

  function replaceRequest(saved: AssetRequest) {
    setRequests((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
  }

  function issueFromDtr(
    id: string,
    input: { serialNumber: string; conditionIssued: DtrIssueCondition },
  ) {
    setCompleting(null);
    persist(
      issueDtrAsset(id, input).then((saved) => replaceRequest(saved)),
    );
  }

  function returnFromDtr(id: string, returnCondition: DtrReturnCondition) {
    setReturning(null);
    persist(
      returnDtrAsset(id, returnCondition).then((saved) => replaceRequest(saved)),
    );
  }

  function deny(id: string, reason: string) {
    const original = requests.find((r) => r.id === id);
    if (!original) return;
    const next: AssetRequest = {
      ...original,
      status: "Denied",
      cancelledAt: new Date().toISOString(),
      resolutionNote: reason,
    };
    setDenying(null);
    if (original.source === "dtr") {
      setRequest(id, next);
      persist(rejectDtrAsset(id, reason).then(replaceRequest), () =>
        setRequest(id, original),
      );
      setUndo({
        message: `Denied ${codeOf(id)}`,
        run: () => revertRequest(original),
      });
      return;
    }
    updateRequest(
      id,
      () => next,
      `${original.status === "Pending" ? "Denied" : "Cancelled"} ${codeOf(id)}`,
    );
  }

  function archive(id: string) {
    const original = requests.find((r) => r.id === id);
    if (!original) return;
    const next: AssetRequest = { ...original, status: "Archived" };
    if (original.source === "dtr") {
      setRequest(id, next);
      persist(archiveExternalAssetRequest(id), () => setRequest(id, original));
      setUndo({
        message: `Archived ${codeOf(id)}`,
        run: () => {
          setRequest(id, original);
          persist(unarchiveExternalAssetRequest(id), () => setRequest(id, next));
        },
      });
      return;
    }
    updateRequest(id, () => next, `Archived ${codeOf(id)}`);
  }

  function unarchive(id: string) {
    const original = requests.find((r) => r.id === id);
    if (!original) return;
    const next: AssetRequest = {
      ...original,
      status: previousStatusAfterUnarchive(original),
    };
    if (original.source === "dtr") {
      setRequest(id, next);
      persist(unarchiveExternalAssetRequest(id), () => setRequest(id, original));
      setUndo({
        message: `Restored ${codeOf(id)}`,
        run: () => {
          setRequest(id, original);
          persist(archiveExternalAssetRequest(id), () => setRequest(id, next));
        },
      });
      return;
    }
    updateRequest(id, () => next, `Restored ${codeOf(id)}`);
  }

  // Puts a closed request back in the queue, clearing its decision.
  function reopen(id: string) {
    const original = requests.find((r) => r.id === id);
    if (!original) return;
    const next: AssetRequest = {
      ...original,
      status: "Pending",
      approvedAt: null,
      completedAt: null,
      cancelledAt: null,
      resolutionNote: null,
    };
    if (original.source === "dtr") {
      setRequest(id, next);
      persist(saveExternalRequestOverride(id, "Pending", null), () =>
        setRequest(id, original),
      );
      setUndo({
        message: `Reopened ${codeOf(id)}`,
        run: () => revertRequest(original),
      });
      return;
    }
    updateRequest(id, () => next, `Reopened ${codeOf(id)}`);
  }

  function deleteRequests(ids: string[]) {
    const removed = requests.filter(
      (r) => ids.includes(r.id) && r.source !== "dtr",
    );
    if (removed.length === 0) return;
    const localIds = removed.map((r) => r.id);
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
    setRequests((prev) => prev.filter((r) => !localIds.includes(r.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of localIds) next.delete(id);
      return next;
    });
    persist(removeAssetRequests(localIds), () => {
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
        <Scrollable className="@container max-h-[calc(100svh-17rem)] min-h-80">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 h-9 w-9 border-r border-border bg-card pl-3 shadow-[inset_0_-1px_0_var(--color-border)]">
                  <Checkbox
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    disabled={selectablePageIds.length === 0}
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
                const fromDtr = request.source === "dtr";
                const canReturn =
                  fromDtr && Boolean(request.issuedAssetId) && !request.returned;
                const isOpen = openRequestStatuses.includes(request.status);
                const canArchive = archiveableStatuses.includes(request.status);
                const isSelected = selected.has(request.id);
                const status = requestStatusStyles[request.status];
                const code = requestCode(request);
                const saving = pendingSaves.has(request.id);
                const overdue =
                  today != null &&
                  request.neededBy != null &&
                  isOpen &&
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
                        disabled={fromDtr}
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
                            {request.requesterEmail || request.department}
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
                        ) : request.status === "Approved" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            onClick={() =>
                              setConfirming({ request, action: "complete" })
                            }
                          >
                            <CircleCheckIcon />
                            {fromDtr ? "Issue" : "Complete"}
                          </Button>
                        ) : request.status === "Denied" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            onClick={() =>
                              setConfirming({ request, action: "reopen" })
                            }
                          >
                            <RotateCcwIcon />
                            Reopen
                          </Button>
                        ) : canArchive ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            onClick={() =>
                              setConfirming({ request, action: "archive" })
                            }
                          >
                            <ArchiveIcon />
                            Archive
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
                            {request.status !== "Archived" && (
                              <DropdownMenuItem
                                onClick={() => openView(request)}
                              >
                                <EyeIcon />
                                View details
                              </DropdownMenuItem>
                            )}
                            {isOpen && !fromDtr && (
                              <DropdownMenuItem
                                onClick={() => openEdit(request)}
                              >
                                <PencilIcon />
                                Edit request
                              </DropdownMenuItem>
                            )}
                            {canReturn && (
                              <DropdownMenuItem
                                onClick={() => setReturning(request)}
                              >
                                <RotateCcwIcon />
                                Mark returned
                              </DropdownMenuItem>
                            )}
                            {request.status === "Pending" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({ request, action: "deny" })
                                }
                              >
                                <XCircleIcon />
                                Deny request
                              </DropdownMenuItem>
                            )}
                            {request.status === "Approved" && !fromDtr && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({ request, action: "deny" })
                                }
                              >
                                <XCircleIcon />
                                Cancel request
                              </DropdownMenuItem>
                            )}
                            {request.status === "Archived" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({ request, action: "unarchive" })
                                }
                              >
                                <ArchiveRestoreIcon />
                                Restore
                              </DropdownMenuItem>
                            )}
                            {request.status === "Denied" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({ request, action: "archive" })
                                }
                              >
                                <ArchiveIcon />
                                Archive
                              </DropdownMenuItem>
                            )}
                            {request.status === "Completed" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirming({ request, action: "reopen" })
                                }
                              >
                                <RotateCcwIcon />
                                Reopen as pending
                              </DropdownMenuItem>
                            )}
                            {!fromDtr && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setPendingDeleteIds([request.id])}
                                >
                                  <Trash2Icon />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
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
            : confirming?.action === "deny"
              ? `${confirming.request.status === "Approved" ? "Cancel" : "Deny"} ${requestCode(confirming.request)}?`
              : confirming?.action === "complete"
                ? `${confirming.request.source === "dtr" ? "Issue" : "Complete"} ${requestCode(confirming.request)}?`
                : confirming?.action === "edit"
                  ? `Save changes to ${requestCode(confirming.request)}?`
                  : confirming?.action === "archive"
                    ? `Archive ${requestCode(confirming.request)}?`
                    : confirming?.action === "unarchive"
                      ? `Restore ${requestCode(confirming.request)}?`
                      : `Reopen ${confirming ? requestCode(confirming.request) : ""}?`
        }
        description={
          !confirming
            ? ""
            : confirming.action === "approve"
              ? `${confirming.request.quantity > 1 ? `${confirming.request.quantity}× ` : ""}${confirming.request.assetType} for ${confirming.request.requesterName}. It moves to Approved until you ${confirming.request.source === "dtr" ? "issue it" : "mark it completed"}. You can undo this afterward.`
              : confirming.action === "deny"
                ? `The employee will be emailed your reason, and IT will be copied. You can undo the status change afterward.`
                : confirming.action === "complete"
                  ? confirming.request.source === "dtr"
                    ? `You'll enter the serial number next. This issues the asset in DTR.`
                    : `You'll note what was handed over next. You can undo this afterward.`
                  : confirming.action === "edit"
                    ? `This updates the request details. You can undo this afterward.`
                    : confirming.action === "archive"
                      ? `${requestCode(confirming.request)} leaves the active queue. You can restore it from Archived, or undo.`
                      : confirming.action === "unarchive"
                        ? `Move ${requestCode(confirming.request)} back to ${previousStatusAfterUnarchive(confirming.request)}. You can undo this afterward.`
                        : `Move ${requestCode(confirming.request)} back to Pending? Its ${confirming.request.status === "Denied" ? "denial" : "completion"} and note will be cleared. You can undo this afterward.`
        }
        confirmLabel={
          confirming?.action === "approve"
            ? "Approve"
            : confirming?.action === "deny" || confirming?.action === "complete"
              ? "Continue"
              : confirming?.action === "edit"
                ? "Save changes"
                : confirming?.action === "archive"
                  ? "Archive"
                  : confirming?.action === "unarchive"
                    ? "Restore"
                    : "Reopen"
        }
        confirmVariant={confirming?.action === "deny" ? "destructive" : "default"}
        icon={
          confirming?.action === "approve"
            ? CheckIcon
            : confirming?.action === "deny"
              ? XCircleIcon
              : confirming?.action === "complete"
                ? CircleCheckIcon
                : confirming?.action === "edit"
                  ? PencilIcon
                  : confirming?.action === "archive"
                    ? ArchiveIcon
                    : confirming?.action === "unarchive"
                      ? ArchiveRestoreIcon
                      : RotateCcwIcon
        }
        onConfirm={() => {
          if (!confirming) return;
          if (confirming.action === "approve") approve(confirming.request.id);
          else if (confirming.action === "deny") setDenying(confirming.request);
          else if (confirming.action === "complete") setCompleting(confirming.request);
          else if (confirming.action === "edit" && confirming.next) {
            applyEdit(confirming.request, confirming.next);
          } else if (confirming.action === "archive") archive(confirming.request.id);
          else if (confirming.action === "unarchive") unarchive(confirming.request.id);
          else if (confirming.action === "reopen") reopen(confirming.request.id);
        }}
      />

      <RequestNoteDialog
        request={denying}
        open={denying !== null}
        onOpenChange={(next) => !next && setDenying(null)}
        title={denying?.status === "Approved" ? "Cancel request" : "Deny request"}
        label="Reason"
        placeholder="e.g. No stock available; existing laptop still under warranty"
        required
        confirmLabel={
          denying?.status === "Approved" ? "Cancel request" : "Deny request"
        }
        confirmVariant="destructive"
        icon={XCircleIcon}
        onConfirm={(reason) => denying && deny(denying.id, reason)}
      />

      {completing?.source === "dtr" ? (
        <IssueDtrAssetDialog
          request={completing}
          open={completing !== null}
          onOpenChange={(next) => !next && setCompleting(null)}
          onConfirm={(input) => completing && issueFromDtr(completing.id, input)}
        />
      ) : (
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
      )}

      <ReturnDtrAssetDialog
        request={returning}
        open={returning !== null}
        onOpenChange={(next) => !next && setReturning(null)}
        onConfirm={(condition) =>
          returning && returnFromDtr(returning.id, condition)
        }
      />

      <AssetRequestDialog
        request={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={async (next) => {
          const original = requests.find((r) => r.id === next.id);
          if (!original) return;
          setConfirming({ request: original, action: "edit", next });
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
