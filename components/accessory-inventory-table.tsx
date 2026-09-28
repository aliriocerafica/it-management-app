"use client";

import { useMemo, useState } from "react";
import {
  BackpackIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleDotIcon,
  DownloadIcon,
  EllipsisIcon,
  EyeIcon,
  HashIcon,
  HeadphonesIcon,
  HourglassIcon,
  TvMinimalIcon,
  MouseIcon,
  PaletteIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TagIcon,
  Trash2Icon,
  Undo2Icon,
  UserIcon,
  UserPlusIcon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { AccessoryDetailsDialog } from "@/components/accessory-details-dialog";
import { AddAccessoryDialog } from "@/components/add-accessory-dialog";
import { AssignLaptopDialog } from "@/components/assign-laptop-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { UndoToast } from "@/components/undo-toast";
import {
  createAccessory,
  removeAccessories,
  saveAccessory,
  saveLaptop,
} from "@/lib/inventory-api";
import { returnedToVacant } from "@/lib/inventory-lifecycle";
import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  isoToday,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table";
import {
  ReturnFromRepairDialog,
  type RepairOutcome,
} from "@/components/return-from-repair-dialog";
import {
  ReturnToStockDialog,
  type AssignedAssets,
} from "@/components/return-to-stock-dialog";
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
  accessoryConfigs,
  type Accessory,
  type AccessoryConfig,
  type AccessoryKind,
} from "@/lib/accessories";
import { type Employee } from "@/lib/employees";
import {
  formatAge,
  formatDate,
  initials,
  parseDate,
  statusStyles,
  statuses,
  warrantyInfo,
  type LaptopStatus,
} from "@/lib/laptops";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

export const accessoryIcons: Record<AccessoryKind, LucideIcon> = {
  headset: HeadphonesIcon,
  mouse: MouseIcon,
  monitor: TvMinimalIcon,
  bag: BackpackIcon,
};

type Tab = "All" | LaptopStatus;
const tabs: Tab[] = ["All", ...statuses];

function exportCsv(
  rows: Accessory[],
  config: AccessoryConfig,
  today: Date | null,
) {
  const header = [
    "Asset tag",
    "Brand",
    "Model",
    "Serial number",
    ...config.specFields.map((field) => field.label),
    "Color",
    "Current handler",
    "Department",
    "Purchase date",
    "Age",
    "Warranty ends",
    "Status",
  ];
  const lines = rows.map((item) => {
    const warranty = today ? warrantyInfo(item, today) : null;
    return [
      item.assetTag,
      item.brand,
      item.model,
      item.serialNumber,
      ...config.specFields.map((field) => item.specs[field.key] ?? ""),
      item.color,
      item.handler ?? "Unassigned",
      item.department ?? "",
      item.purchaseDate,
      today ? formatAge(item.purchaseDate, today) : "",
      warranty ? formatDate(warranty.end) : "",
      item.status,
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
  link.download = `${config.plural.toLowerCase().replaceAll(" ", "-")}-inventory.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AccessoryInventoryTable({
  kind,
  initialData,
}: {
  kind: AccessoryKind;
  initialData: Accessory[];
}) {
  const config = accessoryConfigs[kind];
  const Icon = accessoryIcons[kind];
  const noun = config.singular.toLowerCase();
  const nounPlural = config.plural.toLowerCase();

  const today = useToday();
  const [items, setItems] = useState(initialData);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Accessory | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [assigning, setAssigning] = useState<Accessory | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [repairing, setRepairing] = useState<Accessory | null>(null);
  const [repairOpen, setRepairOpen] = useState(false);
  const [returning, setReturning] = useState<Accessory | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [undo, setUndo] = useState<{
    snapshot: Accessory[];
    removed: Accessory[];
    message: string;
  } | null>(null);

  const brands = useMemo(
    () => [...new Set(items.map((item) => item.brand))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (brandFilter.length && !brandFilter.includes(item.brand)) return false;
      if (tab !== "All" && item.status !== tab) return false;
      if (!q) return true;
      return [
        item.assetTag,
        item.brand,
        item.model,
        item.serialNumber,
        item.handler ?? "",
        item.department ?? "",
        item.color,
        ...Object.values(item.specs),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [items, query, brandFilter, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  const pageIds = pageRows.map((item) => item.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage === pageIds.length;

  const hasFilters = query !== "" || brandFilter.length > 0;

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = {
      All: items.length,
      "In use": 0,
      Vacant: 0,
      "In repair": 0,
      Retired: 0,
    };
    for (const item of items) counts[item.status] += 1;
    return counts;
  }, [items]);

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

  function openView(item: Accessory) {
    setViewing(item);
    setViewOpen(true);
  }

  function openAssign(item: Accessory) {
    setAssigning(item);
    setAssignOpen(true);
  }

  function openReturn(item: Accessory) {
    setRepairing(item);
    setRepairOpen(true);
  }

  function openReturnToStock(item: Accessory) {
    setReturning(item);
    setReturnOpen(true);
  }

  function updateItem(id: string, update: (item: Accessory) => Accessory) {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? update(item) : item));
      const saved = next.find((item) => item.id === id);
      if (saved) void saveAccessory(saved);
      return next;
    });
  }

  function sendToRepair(id: string) {
    const note = `Sent for repair ${formatDate(new Date())}`;
    updateItem(id, (item) => ({
      ...item,
      status: "In repair",
      // Ownership doesn't change during a repair; just annotate the current stint.
      history: item.history.map((entry) =>
        entry.to === null ? { ...entry, note } : entry,
      ),
    }));
  }

  function returnFromRepair(id: string, outcome: RepairOutcome, note: string) {
    const todayIso = isoToday();
    updateItem(id, (item) => {
      if (outcome === "handler") {
        return {
          ...item,
          status: "In use",
          history: item.history.map((entry) =>
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
        ...item,
        status: retire ? "Retired" : "Vacant",
        handler: null,
        department: null,
        history: [
          ...item.history.map((entry) =>
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
    const sameKindIds = new Set([
      target.id,
      ...alsoReturn.accessories
        .filter((accessory) => accessory.kind === kind)
        .map((accessory) => accessory.id),
    ]);
    setItems((prev) => {
      const next = prev.map((item) =>
        sameKindIds.has(item.id) ? returnedToVacant(item, note) : item,
      );
      for (const item of next) {
        if (sameKindIds.has(item.id)) void saveAccessory(item);
      }
      return next;
    });
    for (const accessory of alsoReturn.accessories) {
      if (accessory.kind === kind) continue;
      void saveAccessory(returnedToVacant(accessory, note));
    }
    for (const laptop of alsoReturn.laptops) {
      void saveLaptop(returnedToVacant(laptop, note));
    }
    setReturnOpen(false);
    setReturning(null);
  }

  function assignItem(id: string, employee: Employee, note: string) {
    const todayIso = isoToday();
    updateItem(id, (item) => ({
      ...item,
      handler: employee.name,
      department: employee.department,
      status: "In use",
      // Close out the current "with IT" stint and open one for the new owner.
      history: [
        ...item.history.map((entry) =>
          entry.to === null ? { ...entry, to: todayIso } : entry,
        ),
        {
          handler: employee.name,
          department: employee.department,
          from: todayIso,
          to: null,
          note: note || undefined,
        },
      ],
    }));
    setAssignOpen(false);
  }

  function deleteItems(ids: string[]) {
    const removed = items.filter((item) => ids.includes(item.id));
    setUndo({
      snapshot: items,
      removed,
      message:
        removed.length === 1
          ? `Deleted ${removed[0].assetTag}`
          : `Deleted ${removed.length} ${nounPlural}`,
    });
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    void removeAccessories(ids);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  const pendingDelete = pendingDeleteIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is Accessory => item != null);
  const deleteTitle =
    pendingDelete.length === 1
      ? `Delete ${noun}?`
      : `Delete ${pendingDelete.length} ${nounPlural}?`;
  const deleteDescription =
    pendingDelete.length === 1
      ? `Delete ${pendingDelete[0].brand} ${pendingDelete[0].model} (${pendingDelete[0].assetTag})? You can undo this afterward.`
      : `These ${pendingDelete.length} ${nounPlural} will be removed from inventory. You can undo this afterward.`;

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
        aria-label={`${config.singular} status`}
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
                <Icon className="size-4" />
              ) : (
                <span
                  className={cn("size-2 rounded-full", statusStyles[t].dot)}
                />
              )}
              {t === "All" ? `All ${nounPlural}` : t}
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
              icon={TagIcon}
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
                placeholder={`Search ${nounPlural}`}
                className="h-8 w-full pl-8 text-sm sm:w-48"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => exportCsv(filtered, config, today)}
            >
              <DownloadIcon />
              Export
            </Button>
            <AddAccessoryDialog
              config={config}
              items={items}
              onAdd={(item) => {
                setItems((prev) => [item, ...prev]);
                setTab("All");
                setPage(1);
                void createAccessory(item);
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
                <ColumnHeader icon={Icon}>{config.singular}</ColumnHeader>
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
                <ColumnHeader
                  icon={SlidersHorizontalIcon}
                  className="hidden @5xl:table-cell"
                >
                  Specs
                </ColumnHeader>
                <ColumnHeader
                  icon={PaletteIcon}
                  className="hidden @6xl:table-cell"
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
                <th className="sticky top-0 z-10 h-9 bg-card px-2 shadow-[inset_0_-1px_0_var(--color-border)]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => {
                const isSelected = selected.has(item.id);
                const warranty = today ? warrantyInfo(item, today) : null;
                const status = statusStyles[item.status];
                const summary = config.summary(item.specs);
                return (
                  <tr
                    key={item.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="w-9 border-r border-border pl-3">
                      <Checkbox
                        aria-label={`Select ${item.assetTag}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleRow(item.id, checked)
                        }
                      />
                    </td>
                    <td className={cellClass}>
                      <div className="font-medium">{item.brand}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.model}
                        <span className="font-mono @3xl:hidden">
                          {" "}
                          · {item.assetTag}
                        </span>
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @3xl:table-cell")}>
                      <div className="font-mono">{item.assetTag}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {item.serialNumber}
                      </div>
                    </td>
                    <td className={cellClass}>
                      {item.handler ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="hidden size-6 after:rounded-full @2xl:flex">
                            <AvatarFallback className="bg-muted text-[9px] font-medium">
                              {initials(item.handler)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div>{item.handler}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.department}
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
                        {today ? formatAge(item.purchaseDate, today) : "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(parseDate(item.purchaseDate))}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @5xl:table-cell")}>
                      <div>{summary.primary}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {summary.secondary}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @6xl:table-cell")}>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-3 shrink-0 rounded-full ring-1 ring-foreground/15"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        {item.color}
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
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {/* Same layout on every row: one primary action in a
                          fixed-width slot, everything else in the menu. */}
                      <div className="flex items-center justify-end gap-1">
                        {item.status === "Vacant" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="w-[4.5rem]"
                            onClick={() => openAssign(item)}
                          >
                            <UserPlusIcon />
                            Assign
                          </Button>
                        ) : item.status === "In repair" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="w-[4.5rem]"
                            onClick={() => openReturn(item)}
                          >
                            <Undo2Icon />
                            Return
                          </Button>
                        ) : item.status === "In use" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="w-[4.5rem]"
                            onClick={() => openReturnToStock(item)}
                          >
                            <Undo2Icon />
                            Return
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="w-[4.5rem] text-muted-foreground hover:text-foreground"
                            onClick={() => openView(item)}
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
                                aria-label={`More actions for ${item.assetTag}`}
                                className="text-muted-foreground hover:text-foreground"
                              />
                            }
                          >
                            <EllipsisIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Only what the row's main button doesn't already do. */}
                            {item.status !== "Retired" && (
                              <DropdownMenuItem onClick={() => openView(item)}>
                                <EyeIcon />
                                View details
                              </DropdownMenuItem>
                            )}
                            {(item.status === "In use" ||
                              item.status === "Vacant") && (
                              <DropdownMenuItem
                                onClick={() => sendToRepair(item.id)}
                              >
                                <WrenchIcon />
                                Send to repair
                              </DropdownMenuItem>
                            )}
                            {item.status !== "Retired" && (
                              <DropdownMenuSeparator />
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteIds([item.id])}
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
                    No {nounPlural} match your filters.
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
          setItems(undo.snapshot);
          void Promise.all(undo.removed.map((item) => createAccessory(item)));
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
            : `Delete ${pendingDelete.length} ${nounPlural}`
        }
        onConfirm={() => deleteItems(pendingDeleteIds)}
      />

      <ReturnFromRepairDialog
        laptop={repairing}
        noun={noun}
        open={repairOpen}
        onOpenChange={setRepairOpen}
        onConfirm={(outcome, note) =>
          repairing && returnFromRepair(repairing.id, outcome, note)
        }
      />

      <ReturnToStockDialog
        item={returning}
        itemId={returning?.id ?? null}
        noun={noun}
        open={returnOpen}
        onOpenChange={(open) => {
          setReturnOpen(open)
          if (!open) setReturning(null)
        }}
        onConfirm={returnToStock}
      />

      <AssignLaptopDialog
        laptop={assigning}
        laptops={items}
        noun={noun}
        icon={Icon}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssign={(employee, note) =>
          assigning && assignItem(assigning.id, employee, note)
        }
      />

      <AccessoryDetailsDialog
        item={viewing}
        config={config}
        icon={Icon}
        open={viewOpen}
        onOpenChange={setViewOpen}
        today={today}
      />
    </div>
  );
}
