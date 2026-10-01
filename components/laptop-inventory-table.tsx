"use client";

import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleDotIcon,
  CpuIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  FileTextIcon,
  HashIcon,
  HourglassIcon,
  LaptopIcon,
  PaletteIcon,
  PencilIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
  Undo2Icon,
  UserPlusIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { AccountabilityFormPrompt } from "@/components/accountability-form-prompt";
import { AddLaptopDialog } from "@/components/add-laptop-dialog";
import { AssignLaptopDialog } from "@/components/assign-laptop-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { UndoToast } from "@/components/undo-toast";
import {
  createLaptop,
  removeLaptops,
  saveAccessory,
  saveLaptop,
} from "@/lib/inventory-api";
import { returnedToVacant } from "@/lib/inventory-lifecycle";
import {
  ReturnFromRepairDialog,
  type RepairOutcome,
} from "@/components/return-from-repair-dialog";
import {
  ReturnToStockDialog,
  type AssignedAssets,
} from "@/components/return-to-stock-dialog";
import { SendToRepairDialog } from "@/components/send-to-repair-dialog";
import { LaptopDetailsDialog } from "@/components/laptop-details-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  formatAge,
  formatDate,
  initials,
  parseDate,
  statusStyles,
  statuses,
  warrantyInfo,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops";
import { useToday } from "@/lib/use-today";
import { type Employee } from "@/lib/employees";
import { cn } from "@/lib/utils";

type Tab = "All" | LaptopStatus;
const tabs: Tab[] = ["All", ...statuses];

export const cellClass =
  "border-r border-border px-2.5 py-2 align-middle whitespace-nowrap";

export function isoToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export const rowsPerPageOptions = [10, 15, 25, 50];

function exportCsv(rows: Laptop[], today: Date | null) {
  const header = [
    "Asset tag",
    "Brand",
    "Model",
    "Serial number",
    "CPU",
    "RAM",
    "Storage",
    "OS",
    "Color",
    "Current handler",
    "Department",
    "Purchase date",
    "Age",
    "Warranty ends",
    "Status",
    "Repair issue",
    "Charger connector",
    "Charger wattage",
    "Charger part no.",
    "Charger serial no.",
    "Charger condition",
  ];
  const lines = rows.map((l) => {
    const warranty = today ? warrantyInfo(l, today) : null;
    return [
      l.assetTag,
      l.brand,
      l.model,
      l.serialNumber,
      l.cpu,
      l.ram,
      l.storage,
      l.os,
      l.color,
      l.handler ?? "Unassigned",
      l.department ?? "",
      l.purchaseDate,
      today ? formatAge(l.purchaseDate, today) : "",
      warranty ? formatDate(warranty.end) : "",
      l.status,
      l.status === "In repair" ? (l.repairIssue ?? "") : "",
      l.charger.connector,
      `${l.charger.wattage} W`,
      l.charger.partNumber,
      l.charger.serialNumber,
      l.charger.condition,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",");
  });
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "laptop-inventory.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ColumnHeader({
  icon: Icon,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 h-9 border-r bg-card shadow-[inset_0_-1px_0_var(--color-border)] border-border px-2.5 text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-3" />
        {children}
      </span>
    </th>
  );
}

export function FilterMenu<T extends string>({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: T[];
  selected: T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "rounded-full",
              selected.length > 0 && "border-foreground/40",
            )}
          />
        }
      >
        <Icon className="text-muted-foreground" />
        {label}
        {selected.length > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
            {selected.length}
          </span>
        )}
        <ChevronDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.includes(option)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option]
                    : selected.filter((value) => value !== option),
                )
              }
            >
              {option}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LaptopInventoryTable({
  initialData,
}: {
  initialData: Laptop[];
}) {
  const today = useToday();
  const [laptops, setLaptops] = useState(initialData);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Laptop | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Laptop | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assigning, setAssigning] = useState<Laptop | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [repairing, setRepairing] = useState<Laptop | null>(null);
  const [repairOpen, setRepairOpen] = useState(false);
  const [sendingToRepair, setSendingToRepair] = useState<Laptop | null>(null);
  const [sendRepairOpen, setSendRepairOpen] = useState(false);
  const [returning, setReturning] = useState<Laptop | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [formPrompt, setFormPrompt] = useState<{
    laptopId: string;
    employeeName: string;
  } | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [undo, setUndo] = useState<{
    snapshot: Laptop[];
    removed: Laptop[];
    message: string;
  } | null>(null);

  const brands = useMemo(
    () => [...new Set(laptops.map((l) => l.brand))].sort(),
    [laptops],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return laptops.filter((l) => {
      if (brandFilter.length && !brandFilter.includes(l.brand)) return false;
      if (tab !== "All" && l.status !== tab) return false;
      if (!q) return true;
      return [
        l.assetTag,
        l.brand,
        l.model,
        l.serialNumber,
        l.handler ?? "",
        l.department ?? "",
        l.color,
        l.repairIssue ?? "",
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [laptops, query, brandFilter, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  const pageIds = pageRows.map((l) => l.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage === pageIds.length;

  const hasFilters = query !== "" || brandFilter.length > 0;

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = {
      All: laptops.length,
      "In use": 0,
      Vacant: 0,
      "In repair": 0,
      Retired: 0,
    };
    for (const l of laptops) counts[l.status] += 1;
    return counts;
  }, [laptops]);

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

  function openView(laptop: Laptop) {
    setViewing(laptop);
    setViewOpen(true);
  }

  function openEdit(laptop: Laptop) {
    setEditing(laptop);
    setEditOpen(true);
  }

  function openAssign(laptop: Laptop) {
    setAssigning(laptop);
    setAssignOpen(true);
  }

  function openReturn(laptop: Laptop) {
    setRepairing(laptop);
    setRepairOpen(true);
  }

  function openReturnToStock(laptop: Laptop) {
    setReturning(laptop);
    setReturnOpen(true);
  }

  function openAccountabilityForm(
    laptopId: string,
    names: { hrName: string; itOfficerName: string },
  ) {
    const params = new URLSearchParams()
    const hr = names?.hrName?.trim()
    const it = names?.itOfficerName?.trim()
    if (hr && hr !== "undefined") params.set("hr", hr)
    if (it && it !== "undefined") params.set("it", it)
    const query = params.toString()
    window.open(
      `/api/laptops/${laptopId}/accountability-form${query ? `?${query}` : ""}`,
      "_blank",
    )
  }

  function updateLaptop(id: string, update: (laptop: Laptop) => Laptop) {
    setLaptops((prev) => {
      const next = prev.map((l) => (l.id === id ? update(l) : l));
      const saved = next.find((l) => l.id === id);
      if (saved) void saveLaptop(saved);
      return next;
    });
  }

  function openSendToRepair(laptop: Laptop) {
    setSendingToRepair(laptop);
    setSendRepairOpen(true);
  }

  function sendToRepair(id: string, issue: string) {
    const note = `Sent for repair ${formatDate(new Date())}: ${issue}`;
    updateLaptop(id, (l) => ({
      ...l,
      status: "In repair",
      repairIssue: issue,
      // Ownership doesn't change during a repair; just annotate the current stint.
      history: l.history.map((entry) =>
        entry.to === null ? { ...entry, note } : entry,
      ),
    }));
    setSendRepairOpen(false);
  }

  function returnFromRepair(id: string, outcome: RepairOutcome, note: string) {
    const todayIso = isoToday();
    updateLaptop(id, (l) => {
      if (outcome === "handler") {
        return {
          ...l,
          status: "In use",
          repairIssue: null,
          history: l.history.map((entry) =>
            entry.to === null
              ? {
                  ...entry,
                  note: `Repaired ${formatDate(new Date())}${note ? `: ${note}` : ""}`,
                }
              : entry,
          ),
        };
      }
      const retire = outcome === "retire";
      return {
        ...l,
        status: retire ? "Retired" : "Vacant",
        repairIssue: null,
        handler: null,
        department: null,
        history: [
          ...l.history.map((entry) =>
            entry.to === null ? { ...entry, to: todayIso } : entry,
          ),
          {
            handler: null,
            from: todayIso,
            to: null,
            note:
              (retire
                ? "Retired, beyond repair"
                : "Repaired, ready to assign") + (note ? `: ${note}` : ""),
          },
        ],
      };
    });
    setRepairOpen(false);
  }

  function returnToStock(note: string, alsoReturn: AssignedAssets) {
    const target = returning;
    if (!target) return;
    const laptopIds = new Set([
      target.id,
      ...alsoReturn.laptops.map((laptop) => laptop.id),
    ]);
    setLaptops((prev) => {
      const next = prev.map((laptop) =>
        laptopIds.has(laptop.id) ? returnedToVacant(laptop, note) : laptop,
      );
      for (const laptop of next) {
        if (laptopIds.has(laptop.id)) void saveLaptop(laptop);
      }
      return next;
    });
    for (const accessory of alsoReturn.accessories) {
      void saveAccessory(returnedToVacant(accessory, note));
    }
    setReturnOpen(false);
    setReturning(null);
  }

  function assignLaptop(id: string, employee: Employee, note: string) {
    const todayIso = isoToday();
    updateLaptop(id, (l) => {
      const history = l.history.map((entry) =>
        entry.to === null ? { ...entry, to: todayIso } : entry,
      );
      return {
        ...l,
        handler: employee.name,
        department: employee.department,
        status: "In use",
        history: [
          ...history,
          {
            handler: employee.name,
            department: employee.department,
            from: todayIso,
            to: null,
            note: note || undefined,
          },
        ],
      };
    });
    setAssignOpen(false);
    setFormPrompt({ laptopId: id, employeeName: employee.name });
  }

  function deleteLaptops(ids: string[]) {
    const removed = laptops.filter((laptop) => ids.includes(laptop.id));
    setUndo({
      snapshot: laptops,
      removed,
      message:
        removed.length === 1
          ? `Deleted ${removed[0].assetTag}`
          : `Deleted ${removed.length} laptops`,
    });
    setLaptops((prev) => prev.filter((l) => !ids.includes(l.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    void removeLaptops(ids);
  }

  const pendingDelete = pendingDeleteIds
    .map((id) => laptops.find((laptop) => laptop.id === id))
    .filter((laptop): laptop is Laptop => laptop != null);
  const deleteTitle =
    pendingDelete.length === 1
      ? "Delete laptop?"
      : `Delete ${pendingDelete.length} laptops?`;
  const deleteDescription =
    pendingDelete.length === 1
      ? `Delete ${pendingDelete[0].brand} ${pendingDelete[0].model} (${pendingDelete[0].assetTag})? You can undo this afterward.`
      : `These ${pendingDelete.length} laptops will be removed from inventory. You can undo this afterward.`;

  function clearFilters() {
    setQuery("");
    setBrandFilter([]);
    setPage(1);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Folder tabs: the active tab joins the card below */}
      <div
        role="tablist"
        aria-label="Laptop status"
        className="flex items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
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
                <LaptopIcon className="size-4" />
              ) : (
                <span
                  className={cn("size-2 rounded-full", statusStyles[t].dot)}
                />
              )}
              {t === "All" ? "All laptops" : t}
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
              label="Brand"
              icon={LaptopIcon}
              options={brands}
              selected={brandFilter}
              onChange={(value) => {
                setBrandFilter(value);
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
                placeholder="Search laptops"
                className="h-8 w-full pl-8 text-sm sm:w-48"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => exportCsv(filtered, today)}
            >
              <DownloadIcon />
              Export
            </Button>
            <AddLaptopDialog
              laptops={laptops}
              onAdd={(laptop) => {
                setLaptops((prev) => [laptop, ...prev]);
                setTab("All");
                setPage(1);
                void createLaptop(laptop);
              }}
            />
          </div>
        </div>

        {/* Table: rows scroll under a sticky header; columns drop out by priority as the card narrows */}
        <div className="@container max-h-[calc(100svh-17rem)] min-h-80 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                <ColumnHeader icon={LaptopIcon}>Laptop</ColumnHeader>
                <ColumnHeader
                  icon={HashIcon}
                  className="hidden @3xl:table-cell"
                >
                  Asset tag
                </ColumnHeader>
                <ColumnHeader icon={UserIcon}>Handler</ColumnHeader>
                <ColumnHeader
                  icon={HourglassIcon}
                  className="hidden @xl:table-cell"
                >
                  Age
                </ColumnHeader>
                <ColumnHeader icon={CpuIcon} className="hidden @5xl:table-cell">
                  Specs
                </ColumnHeader>
                <ColumnHeader
                  icon={PaletteIcon}
                  className="hidden @7xl:table-cell"
                >
                  Color
                </ColumnHeader>
                <ColumnHeader
                  icon={ShieldCheckIcon}
                  className="hidden @4xl:table-cell"
                >
                  Warranty
                </ColumnHeader>
                <ColumnHeader icon={CircleDotIcon}>Status</ColumnHeader>
                <th className="sticky top-0 z-10 h-9 min-w-[8.5rem] bg-card px-2 text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((laptop) => {
                const isSelected = selected.has(laptop.id);
                const warranty = today ? warrantyInfo(laptop, today) : null;
                const status = statusStyles[laptop.status];
                return (
                  <tr
                    key={laptop.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="w-9 border-r border-border pl-3">
                      <Checkbox
                        aria-label={`Select ${laptop.assetTag}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleRow(laptop.id, checked)
                        }
                      />
                    </td>
                    <td className={cellClass}>
                      <div className="font-medium">{laptop.brand}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {laptop.model}
                        <span className="font-mono @3xl:hidden">
                          {" "}
                          · {laptop.assetTag}
                        </span>
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @3xl:table-cell")}>
                      <div className="font-mono">{laptop.assetTag}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {laptop.serialNumber}
                      </div>
                    </td>
                    <td className={cellClass}>
                      {laptop.handler ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="hidden size-6 after:rounded-full @2xl:flex">
                            <AvatarFallback className="bg-muted text-[9px] font-medium">
                              {initials(laptop.handler)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div>{laptop.handler}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {laptop.department}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "hidden tabular-nums @xl:table-cell",
                      )}
                    >
                      <div>
                        {today ? formatAge(laptop.purchaseDate, today) : "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(parseDate(laptop.purchaseDate))}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @5xl:table-cell")}>
                      <div>{laptop.cpu}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {laptop.ram} · {laptop.storage} · {laptop.os}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @7xl:table-cell")}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-3 shrink-0 rounded-full ring-1 ring-foreground/15"
                          style={{ backgroundColor: laptop.colorHex }}
                        />
                        {laptop.color}
                      </span>
                    </td>
                    <td className={cn(cellClass, "hidden @4xl:table-cell")}>
                      {warranty ? (
                        <div className="leading-tight">
                          <span
                            className={cn(
                              "inline-flex rounded px-1.5 py-px text-[11px] font-medium",
                              warranty.state === "Active" &&
                                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                              warranty.state === "Expiring" &&
                                "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                              warranty.state === "Expired" &&
                                "bg-muted text-muted-foreground",
                            )}
                          >
                            {warranty.state}
                          </span>
                          <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                            {warranty.state === "Expired" ? "Ended" : "Until"}{" "}
                            {formatDate(warranty.end)}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
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
                        {laptop.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {/* Same layout on every row: one primary action in a
                          fixed-width slot, everything else in the menu. */}
                      <div className="flex items-center justify-end gap-1">
                        {laptop.status === "Vacant" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-[6.75rem]"
                            onClick={() => openAssign(laptop)}
                          >
                            <UserPlusIcon />
                            Assign
                          </Button>
                        ) : laptop.status === "In repair" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-[6.75rem]"
                            onClick={() => openReturn(laptop)}
                          >
                            <Undo2Icon />
                            Mark repaired
                          </Button>
                        ) : laptop.status === "In use" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-[6.75rem]"
                            onClick={() => openReturnToStock(laptop)}
                          >
                            <Undo2Icon />
                            Return
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="min-w-[6.75rem] text-muted-foreground hover:text-foreground"
                            onClick={() => openView(laptop)}
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
                                aria-label={`More actions for ${laptop.assetTag}`}
                                className="text-muted-foreground hover:text-foreground"
                              />
                            }
                          >
                            <EllipsisIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Only what the row's main button doesn't already do. */}
                            {laptop.status !== "Retired" && (
                              <DropdownMenuItem
                                onClick={() => openView(laptop)}
                              >
                                <EyeIcon />
                                View details
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openEdit(laptop)}
                            >
                              <PencilIcon />
                              Edit details
                            </DropdownMenuItem>
                            {(laptop.status === "In use" ||
                              laptop.status === "Vacant") && (
                              <DropdownMenuItem
                                onClick={() => openSendToRepair(laptop)}
                              >
                                <WrenchIcon />
                                Send to repair
                              </DropdownMenuItem>
                            )}
                            {laptop.handler && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setFormPrompt({
                                    laptopId: laptop.id,
                                    employeeName: laptop.handler!,
                                  })
                                }
                              >
                                <FileTextIcon />
                                Accountability form
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteIds([laptop.id])}
                            >
                              <Trash2Icon />
                              Delete
                            </DropdownMenuItem>
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
                    colSpan={10}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No laptops match your filters.
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
          if (!undo) return;
          setLaptops(undo.snapshot);
          void Promise.all(undo.removed.map((laptop) => createLaptop(laptop)));
          setUndo(null);
        }}
        onDismiss={() => setUndo(null)}
      />

      <ConfirmDeleteDialog
        open={pendingDeleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIds([]);
        }}
        title={deleteTitle}
        description={deleteDescription}
        confirmLabel={
          pendingDelete.length === 1
            ? "Delete"
            : `Delete ${pendingDelete.length} laptops`
        }
        onConfirm={() => deleteLaptops(pendingDeleteIds)}
      />

      <SendToRepairDialog
        laptop={sendingToRepair}
        open={sendRepairOpen}
        onOpenChange={(open) => {
          setSendRepairOpen(open);
          if (!open) setSendingToRepair(null);
        }}
        onConfirm={(issue) =>
          sendingToRepair && sendToRepair(sendingToRepair.id, issue)
        }
      />

      <ReturnFromRepairDialog
        laptop={repairing}
        open={repairOpen}
        onOpenChange={setRepairOpen}
        onConfirm={(outcome, note) =>
          repairing && returnFromRepair(repairing.id, outcome, note)
        }
      />

      <ReturnToStockDialog
        item={returning}
        itemId={returning?.id ?? null}
        open={returnOpen}
        onOpenChange={(open) => {
          setReturnOpen(open)
          if (!open) setReturning(null)
        }}
        onConfirm={returnToStock}
      />

      <AssignLaptopDialog
        laptop={assigning}
        laptops={laptops}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssign={(employee, note) =>
          assigning && assignLaptop(assigning.id, employee, note)
        }
      />

      <AddLaptopDialog
        key={editing?.id}
        laptops={laptops}
        laptop={editing}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(saved) => updateLaptop(saved.id, () => saved)}
      />

      <LaptopDetailsDialog
        laptop={viewing}
        open={viewOpen}
        onOpenChange={setViewOpen}
        today={today}
      />

      <AccountabilityFormPrompt
        open={formPrompt !== null}
        onOpenChange={(next) => !next && setFormPrompt(null)}
        employeeName={formPrompt?.employeeName}
        onGenerate={(names) =>
          formPrompt && openAccountabilityForm(formPrompt.laptopId, names)
        }
      />
    </div>
  );
}
