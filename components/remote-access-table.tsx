"use client"

import { useMemo, useState } from "react"
import {
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  LaptopIcon,
  MonitorPlayIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "lucide-react"

import { AnyDeskIcon } from "@/components/anydesk-icon"
import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  anydeskHref,
  formatAnydeskAddress,
  parseAnydeskAddress,
} from "@/lib/anydesk"
import { errorMessage, saveLaptop } from "@/lib/inventory-api"
import { initials, statusStyles } from "@/lib/laptops"
import type { RemoteAccessRow } from "@/lib/remote-access"
import { cn } from "@/lib/utils"

type Tab = "All" | "In use" | "In repair" | "Unassigned"
const tabs: Tab[] = ["All", "In use", "In repair", "Unassigned"]

function rowStatus(row: RemoteAccessRow): Tab {
  const status = row.laptop?.status
  if (status === "In use" || status === "In repair") return status
  return "Unassigned"
}

export function RemoteAccessTable({
  rows: initialRows,
}: {
  rows: RemoteAccessRow[]
}) {
  const [rows, setRows] = useState(initialRows)
  // The laptop whose AnyDesk address is being typed in, if any.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [brandFilter, setBrandFilter] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>("All")
  const [rowsPerPage, setRowsPerPage] = useState(15)
  const [page, setPage] = useState(1)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const departments = useMemo(
    () => [...new Set(rows.map((row) => row.employee.department))].sort(),
    [rows],
  )
  const brands = useMemo(
    () =>
      [...new Set(rows.map((row) => row.laptop?.brand).filter(Boolean))].sort() as string[],
    [rows],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(({ employee, laptop }) => {
      if (departmentFilter.length && !departmentFilter.includes(employee.department)) {
        return false
      }
      if (brandFilter.length && (!laptop || !brandFilter.includes(laptop.brand))) {
        return false
      }
      if (tab !== "All" && rowStatus({ employee, laptop }) !== tab) {
        return false
      }
      if (!q) return true
      return [
        employee.name,
        employee.department,
        employee.title,
        employee.email,
        laptop?.assetTag ?? "",
        laptop?.brand ?? "",
        laptop?.model ?? "",
        laptop?.anydeskAddress ?? "",
        laptop?.status ?? "Unassigned",
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [brandFilter, departmentFilter, query, rows, tab])

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)
  const hasFilters = query !== "" || departmentFilter.length > 0 || brandFilter.length > 0

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(tabs.map((t) => [t, 0])) as Record<Tab, number>
    counts.All = rows.length
    for (const row of rows) counts[rowStatus(row)] += 1
    return counts
  }, [rows])

  function clearFilters() {
    setQuery("")
    setDepartmentFilter([])
    setBrandFilter([])
    setPage(1)
  }

  function startEditing(laptopId: string, current: string | null) {
    setEditingId(laptopId)
    setDraft(current ? formatAnydeskAddress(current) : "")
    setEditError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditError(null)
  }

  async function saveAddress(row: RemoteAccessRow) {
    const laptop = row.laptop
    if (!laptop || saving) return
    const input = draft.trim()
    const address = input ? parseAnydeskAddress(input) : null
    if (input && !address) {
      setEditError("Enter the 9 or 10 digit AnyDesk address.")
      return
    }
    setSaving(true)
    try {
      const saved = await saveLaptop({ ...laptop, anydeskAddress: address })
      setRows((prev) =>
        prev.map((r) => (r.laptop?.id === saved.id ? { ...r, laptop: saved } : r)),
      )
      setEditingId(null)
      setEditError(null)
    } catch (error) {
      setEditError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(formatAnydeskAddress(address))
    setCopiedId(address)
    window.setTimeout(() => {
      setCopiedId((current) => (current === address ? null : current))
    }, 1500)
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div
        role="tablist"
        aria-label="Laptop status"
        className="flex items-end gap-1 overflow-x-auto pr-1 [scrollbar-width:thin]"
      >
        {tabs.map((t) => {
          const active = t === tab
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t)
                setPage(1)
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "z-10 -mb-px h-10 border-border bg-card pb-px text-foreground"
                  : "h-9 border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t === "All" ? (
                <AnyDeskIcon className="size-4" />
              ) : t === "Unassigned" ? (
                <span className="size-2 rounded-full bg-muted-foreground/50" />
              ) : (
                <span className={cn("size-2 rounded-full", statusStyles[t].dot)} />
              )}
              {t === "All" ? "All employees" : t}
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
          )
        })}
        <span className="w-2 shrink-0" aria-hidden />
      </div>

      <div className="flex min-w-0 flex-col rounded-2xl rounded-tl-none border border-border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterMenu
              label="Department"
              icon={BuildingIcon}
              options={departments}
              selected={departmentFilter}
              onChange={(value) => {
                setDepartmentFilter(value)
                setPage(1)
              }}
            />
            <FilterMenu
              label="Brand"
              icon={LaptopIcon}
              options={brands}
              selected={brandFilter}
              onChange={(value) => {
                setBrandFilter(value)
                setPage(1)
              }}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon />
                Clear
              </Button>
            )}
          </div>
          <div className="relative min-w-48 flex-1 sm:max-w-56 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search employees"
              className="h-8 w-full pl-8 text-sm"
            />
          </div>
        </div>

        <div className="@container max-h-[calc(100svh-17rem)] min-h-80 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <ColumnHeader icon={UserIcon}>Employee</ColumnHeader>
                <ColumnHeader icon={LaptopIcon}>Laptop</ColumnHeader>
                <ColumnHeader icon={MonitorPlayIcon}>Laptop status</ColumnHeader>
                <ColumnHeader icon={AnyDeskIcon} className="w-full">
                  AnyDesk
                </ColumnHeader>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const { employee, laptop } = row
                const status = laptop ? statusStyles[laptop.status] : null
                const address = laptop?.anydeskAddress ?? null
                const isEditing = laptop != null && editingId === laptop.id
                return (
                  <tr
                    key={laptop?.id ?? employee.id}
                    className="border-b border-border transition-colors hover:bg-muted/50"
                  >
                    <td className={cellClass}>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {initials(employee.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {[employee.title, employee.department]
                              .filter(Boolean)
                              .join(" · ") || "No department"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={cellClass}>
                      {laptop ? (
                        <div>
                          <div className="font-medium">
                            {laptop.brand} {laptop.model}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {laptop.assetTag}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No laptop</span>
                      )}
                    </td>
                    <td className={cellClass}>
                      {status ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 font-medium",
                            status.text,
                          )}
                        >
                          <span
                            className={cn("size-1.5 rounded-full", status.dot)}
                          />
                          {laptop?.status}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className={cn(cellClass, "w-full")}>
                      <div className="flex w-full items-center justify-between gap-3">
                        {isEditing ? (
                          <form
                            className="flex w-full flex-col gap-1"
                            onSubmit={(event) => {
                              event.preventDefault()
                              void saveAddress(row)
                            }}
                          >
                            <div className="flex items-center gap-1">
                              <Input
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") cancelEditing()
                                }}
                                placeholder="123 456 789"
                                inputMode="numeric"
                                aria-label={`AnyDesk address for ${employee.name}`}
                                aria-invalid={editError ? true : undefined}
                                className="h-7 max-w-40 font-mono text-sm"
                                autoFocus
                              />
                              <Button type="submit" size="xs" disabled={saving}>
                                <CheckIcon />
                                {saving ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                disabled={saving}
                                onClick={cancelEditing}
                              >
                                Cancel
                              </Button>
                            </div>
                            {editError && (
                              <p role="alert" className="text-[11px] text-destructive">
                                {editError}
                              </p>
                            )}
                          </form>
                        ) : address ? (
                          <>
                            <span className="font-mono text-sm tabular-nums">
                              {formatAnydeskAddress(address)}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="outline"
                                size="xs"
                                className="min-w-16"
                                aria-label={`Copy AnyDesk address for ${employee.name}`}
                                onClick={() => copyAddress(address)}
                              >
                                {copiedId === address ? (
                                  <>
                                    <CheckIcon />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <CopyIcon />
                                    Copy
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="xs"
                                nativeButton={false}
                                render={
                                  <a
                                    href={anydeskHref(address)}
                                    aria-label={`Open AnyDesk for ${employee.name}`}
                                  />
                                }
                              >
                                <ExternalLinkIcon />
                                Open
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Edit AnyDesk address for ${employee.name}`}
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => startEditing(laptop!.id, address)}
                              >
                                <PencilIcon />
                              </Button>
                            </div>
                          </>
                        ) : laptop ? (
                          <>
                            <span className="text-muted-foreground italic">
                              No address
                            </span>
                            <Button
                              variant="outline"
                              size="xs"
                              className="shrink-0"
                              onClick={() => startEditing(laptop.id, null)}
                            >
                              <PlusIcon />
                              Add address
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No employees match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
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
                  setRowsPerPage(value as number)
                  setPage(1)
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
          </div>

          <div className="flex items-center gap-1">
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
    </div>
  )
}
