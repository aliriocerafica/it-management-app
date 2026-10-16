"use client"

import Link from "next/link"
import { useEffect, useId, useMemo, useState, type ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  AwardIcon,
  BackpackIcon,
  BatteryIcon,
  KeyboardIcon,
  BarChart3Icon,
  BuildingIcon,
  Building2Icon,
  CircleDotIcon,
  ClockIcon,
  HeadphonesIcon,
  LaptopIcon,
  MemoryStickIcon,
  MessageCircleIcon,
  MouseIcon,
  PlugIcon,
  PackageIcon,
  PieChartIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  TvMinimalIcon,
  UserCheckIcon,
  UsersIcon,
  WifiIcon,
  WrenchIcon,
  XIcon,
  BoxesIcon,
  type LucideIcon,
} from "lucide-react"

import type { Accessory, AccessoryKind } from "@/lib/accessories"
import { accessoryConfigs } from "@/lib/accessories"
import {
  grades,
  gradeHex,
  gradeInfo,
  gradeLaptop,
  average,
  type Grade,
} from "@/lib/laptop-analytics"
import type { StatusCounts } from "@/lib/inventory-map"
import {
  formatDate,
  parseDate,
  statusStyles,
  statuses,
  warrantyInfo,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops"
import { useAnimatedNumber } from "@/lib/use-animated-number"
import { inDateRange, toIsoDay, type DateRange } from "@/lib/date-range"
import { useToday } from "@/lib/use-today"
import type { SessionUser } from "@/lib/auth/dto"
import type { UserDto } from "@/lib/user-repository"
import { cn } from "@/lib/utils"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { FilterMenu } from "@/components/laptop-inventory-table"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Button } from "@/components/ui/button"

const UNASSIGNED = "Unassigned"

function countStatuses(items: { status: LaptopStatus }[]): StatusCounts {
  const counts: StatusCounts = {
    total: items.length,
    "In use": 0,
    Vacant: 0,
    "In repair": 0,
    Retired: 0,
  }
  for (const item of items) counts[item.status] += 1
  return counts
}

const accessoryRoutes: Record<AccessoryKind, string> = {
  headset: "/dashboard/headsets",
  mouse: "/dashboard/mice",
  monitor: "/dashboard/monitors",
  bag: "/dashboard/laptop-bags",
  battery: "/dashboard/batteries",
  keyboard: "/dashboard/keyboards",
  ram: "/dashboard/ram",
  charger: "/dashboard/chargers",
}

// Status columns in the Assets table; retired items aren't on hand.
const assetStatusColumns: LaptopStatus[] = ["Vacant", "In use", "In repair"]

const accessoryIcons: Record<AccessoryKind, LucideIcon> = {
  headset: HeadphonesIcon,
  mouse: MouseIcon,
  monitor: TvMinimalIcon,
  bag: BackpackIcon,
  battery: BatteryIcon,
  keyboard: KeyboardIcon,
  ram: MemoryStickIcon,
  charger: PlugIcon,
}

const warrantyStyles = {
  Active: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  Expiring: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  Expired: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
} as const

const statusChartColors: Record<LaptopStatus, string> = {
  "In use": "var(--color-emerald-500)",
  Vacant: "var(--color-sky-500)",
  "In repair": "var(--color-amber-500)",
  Retired: "var(--color-red-500)",
}

const shortCategory: Record<string, string> = {
  Laptops: "Laptops",
  Headsets: "Headsets",
  Mice: "Mice",
  Keyboards: "Keys",
  Monitors: "Monitors",
  "Laptop bags": "Bags",
  Batteries: "Batteries",
  "RAM modules": "RAM",
  Chargers: "Chargers",
}

function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {children}
    </div>
  )
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      {color && (
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
      )}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-mono font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}

// A flat cell in the bento grid; the grid's 1px gaps draw the dividers
// between cards instead of each card carrying its own border/shadow.
function Tile({
  href,
  className,
  children,
}: {
  href?: string
  className?: string
  children: ReactNode
}) {
  const classes = cn(
    "flex min-w-0 flex-col gap-3 bg-background p-4 text-card-foreground",
    href && "transition-colors hover:bg-muted/40",
    className,
  )
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }
  return <div className={classes}>{children}</div>
}

function TileHeader({
  icon: Icon,
  label,
  hint,
}: {
  icon: LucideIcon
  label: string
  hint?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {label}
      </span>
      {hint && (
        <span className="text-[11px] text-muted-foreground tabular-nums">{hint}</span>
      )}
    </div>
  )
}

function AnimatedNumber({
  value,
  delay = 0,
  duration = 900,
  suffix = "",
}: {
  value: number
  delay?: number
  duration?: number
  suffix?: string
}) {
  const n = useAnimatedNumber(value, { duration, delay })
  return (
    <>
      {Math.round(n).toLocaleString()}
      {suffix}
    </>
  )
}

function Meter({ value, className }: { value: number; className?: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full bg-primary", className)}
        style={{
          width: ready || reduce ? `${pct}%` : "0%",
          transition: reduce
            ? undefined
            : "width 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  )
}

function MiniSpark({
  data,
  color = "var(--color-chart-1)",
}: {
  data: { value: number }[]
  color?: string
}) {
  if (data.length < 2) return null
  return (
    <ChartContainer
      config={{ value: { label: "Trend", color } }}
      className="aspect-auto h-9 w-full"
    >
      <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Line
          dataKey="value"
          type="monotone"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          animationDuration={900}
        />
      </LineChart>
    </ChartContainer>
  )
}

type Attention = {
  href: string
  tag: string
  title: string
  reason: string
  tone: "red" | "amber" | "sky"
}

type Activity = {
  key: string
  href: string
  tag: string
  title: string
  detail: string
  when: string
}

export function DashboardOverview({
  user,
  laptops: allLaptops,
  accessories: allAccessories,
  users,
}: {
  user: SessionUser
  laptops: Laptop[]
  accessories: Accessory[]
  users: UserDto[]
}) {
  const today = useToday()
  const growthFillId = useId().replace(/:/g, "")
  const assignFillId = useId().replace(/:/g, "")
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [brandFilter, setBrandFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<LaptopStatus[]>([])
  const [gradeFilter, setGradeFilter] = useState<Grade[]>([])
  // The days the Released tile and column count; this month when unset.
  const [dateRange, setDateRange] = useState<DateRange | null>(null)

  const departments = useMemo(
    () =>
      [
        ...new Set(
          [...allLaptops, ...allAccessories].map(
            (item) => item.department ?? UNASSIGNED,
          ),
        ),
      ].sort(),
    [allLaptops, allAccessories],
  )
  const brands = useMemo(
    () =>
      [...new Set([...allLaptops, ...allAccessories].map((item) => item.brand))].sort(),
    [allLaptops, allAccessories],
  )

  const accessories = useMemo(
    () =>
      allAccessories.filter(
        (item) =>
          (departmentFilter.length === 0 ||
            departmentFilter.includes(item.department ?? UNASSIGNED)) &&
          (brandFilter.length === 0 || brandFilter.includes(item.brand)) &&
          (statusFilter.length === 0 || statusFilter.includes(item.status)),
      ),
    [allAccessories, departmentFilter, brandFilter, statusFilter],
  )
  const laptops = useMemo(
    () =>
      allLaptops.filter(
        (laptop) =>
          (departmentFilter.length === 0 ||
            departmentFilter.includes(laptop.department ?? UNASSIGNED)) &&
          (brandFilter.length === 0 || brandFilter.includes(laptop.brand)) &&
          (statusFilter.length === 0 || statusFilter.includes(laptop.status)) &&
          (gradeFilter.length === 0 ||
            !today ||
            gradeFilter.includes(gradeLaptop(laptop, today).grade)),
      ),
    [allLaptops, departmentFilter, brandFilter, statusFilter, gradeFilter, today],
  )

  const hasFilters =
    departmentFilter.length > 0 ||
    brandFilter.length > 0 ||
    statusFilter.length > 0 ||
    gradeFilter.length > 0

  function clearFilters() {
    setDepartmentFilter([])
    setBrandFilter([])
    setStatusFilter([])
    setGradeFilter([])
  }

  const summary = {
    laptops: countStatuses(laptops),
    ...(Object.fromEntries(
      (Object.keys(accessoryConfigs) as AccessoryKind[]).map((kind) => [
        kind,
        countStatuses(accessories.filter((item) => item.kind === kind)),
      ]),
    ) as Record<AccessoryKind, StatusCounts>),
  }

  const categories = (Object.keys(accessoryConfigs) as AccessoryKind[]).map(
    (kind) => ({
      kind,
      title: accessoryConfigs[kind].plural,
      href: accessoryRoutes[kind],
      icon: accessoryIcons[kind],
      counts: summary[kind],
    }),
  )

  const vacantTotal =
    summary.laptops.Vacant + categories.reduce((sum, c) => sum + c.counts.Vacant, 0)
  const repairTotal =
    summary.laptops["In repair"] +
    categories.reduce((sum, c) => sum + c.counts["In repair"], 0)
  const deviceTotal =
    summary.laptops.total + categories.reduce((sum, c) => sum + c.counts.total, 0)

  const graded = useMemo(() => {
    if (!today) return []
    return laptops
      .filter((l) => l.status !== "Retired")
      .map((l) => gradeLaptop(l, today))
  }, [today, laptops])
  const fleetScore = graded.length
    ? Math.round(average(graded.map((g) => g.score)))
    : null
  const dueForReplacement = graded.filter(
    (g) => g.grade === "D" || g.grade === "F",
  ).length

  const warrantyCounts = useMemo(() => {
    const counts = { Active: 0, Expiring: 0, Expired: 0 }
    if (!today) return counts
    for (const laptop of laptops) {
      if (laptop.status === "Retired") continue
      counts[warrantyInfo(laptop, today).state] += 1
    }
    return counts
  }, [today, laptops])

  // The days the Released tile and column count: the picked range, or this
  // month until one is picked.
  const releasePeriod = useMemo((): DateRange | null => {
    if (dateRange) return dateRange
    if (!today) return null
    return {
      from: toIsoDay(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toIsoDay(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    }
  }, [dateRange, today])

  // Releases (assignments to someone) in that period, per asset type.
  const releases = useMemo(() => {
    const count = (items: { history: { handler: string | null; from: string }[] }[]) => {
      let total = 0
      for (const item of items) {
        for (const entry of item.history) {
          if (entry.handler && releasePeriod && inDateRange(entry.from, releasePeriod)) {
            total++
          }
        }
      }
      return total
    }
    const laptopReleases = count(laptops)
    const byKind = Object.fromEntries(
      (Object.keys(accessoryConfigs) as AccessoryKind[]).map((kind) => [
        kind,
        count(accessories.filter((item) => item.kind === kind)),
      ]),
    ) as Record<AccessoryKind, number>
    return {
      laptops: laptopReleases,
      byKind,
      total: laptopReleases + Object.values(byKind).reduce((sum, n) => sum + n, 0),
    }
  }, [laptops, accessories, releasePeriod])

  // Biggest stock first; types with nothing on hand or released go last.
  const assetRows = [
    {
      key: "laptops",
      title: "Laptops",
      href: "/dashboard/laptops",
      icon: LaptopIcon as LucideIcon,
      counts: summary.laptops,
      released: releases.laptops,
    },
    ...categories.map((category) => ({
      key: category.kind,
      title: category.title,
      href: category.href,
      icon: category.icon,
      counts: category.counts,
      released: releases.byKind[category.kind],
    })),
  ].sort((a, b) => {
    const emptyA = a.counts.total === 0 && a.released === 0
    const emptyB = b.counts.total === 0 && b.released === 0
    if (emptyA !== emptyB) return emptyA ? 1 : -1
    return b.counts.total - a.counts.total || b.released - a.released
  })
  const maxOnHand = Math.max(1, ...assetRows.map((row) => row.counts.total))

  const assignedLaptops = laptops.filter(
    (l) => l.status !== "Vacant" && l.status !== "Retired",
  )
  const remoteConfigured = assignedLaptops.filter((l) => l.anydeskAddress).length
  const remoteCoverage = assignedLaptops.length
    ? remoteConfigured / assignedLaptops.length
    : 0

  const missingChargers = laptops.filter(
    (laptop) =>
      laptop.status !== "Retired" && laptop.charger.condition === "Missing",
  )

  const departmentCounts = new Map<string, number>()
  for (const item of [...laptops, ...accessories]) {
    if (!item.department) continue
    departmentCounts.set(
      item.department,
      (departmentCounts.get(item.department) ?? 0) + 1,
    )
  }
  const topDepartments = [...departmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const departmentChartData = topDepartments.map(([department, value]) => ({
    department,
    value,
  }))

  const brandCounts = new Map<string, number>()
  for (const laptop of laptops) {
    brandCounts.set(laptop.brand, (brandCounts.get(laptop.brand) ?? 0) + 1)
  }
  const brandChartData = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([brand, value]) => ({ brand, value }))

  const activeUsers = users.filter((u) => u.isActive)
  const adminUsers = users.filter((u) => u.role === "ADMIN")

  const growthData = useMemo(() => {
    if (!today) return []
    const items = [...laptops, ...accessories]
    const points: { label: string; total: number; assigned: number }[] = []
    for (let offset = -11; offset <= 0; offset++) {
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0)
      const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      const total = items.filter(
        (item) => parseDate(item.purchaseDate) <= monthEnd,
      ).length
      let assigned = 0
      for (const item of items) {
        for (const entry of item.history) {
          if (!entry.handler) continue
          const from = parseDate(entry.from)
          if (from >= monthStart && from <= monthEnd) assigned++
        }
      }
      points.push({
        label: monthEnd.toLocaleDateString("en-GB", { month: "short" }),
        total,
        assigned,
      })
    }
    return points
  }, [today, laptops, accessories])

  const assignSpark = growthData.slice(-6).map((row) => ({ value: row.assigned }))
  const vacantSpark = useMemo(() => {
    if (!today) return []
    return growthData.slice(-6).map((row, i, rows) => ({
      value: i === rows.length - 1 ? vacantTotal : Math.max(0, row.total - row.assigned),
    }))
  }, [today, growthData, vacantTotal])

  const growthChartConfig = {
    total: { label: "On hand", color: "var(--color-chart-1)" },
    assigned: { label: "Assigned", color: "var(--color-chart-2)" },
  } satisfies ChartConfig

  const statusTotals = statuses.reduce(
    (acc, status) => {
      acc[status] =
        summary.laptops[status] + categories.reduce((s, c) => s + c.counts[status], 0)
      return acc
    },
    {} as Record<LaptopStatus, number>,
  )
  const statusPieData = statuses
    .map((status) => ({
      status,
      value: statusTotals[status],
      fill: statusChartColors[status],
    }))
    .filter((row) => row.value > 0)
  const statusChartConfig = Object.fromEntries(
    statuses.map((status) => [
      status,
      { label: status, color: statusChartColors[status] },
    ]),
  ) satisfies ChartConfig

  const stackedCategoryData = [
    {
      label: "Laptops",
      ...Object.fromEntries(statuses.map((status) => [status, summary.laptops[status]])),
    },
    ...categories.map((c) => ({
      label: shortCategory[c.title] ?? c.title,
      ...Object.fromEntries(statuses.map((status) => [status, c.counts[status]])),
    })),
  ]
  const stackedChartConfig = Object.fromEntries(
    statuses.map((status) => [
      status,
      { label: status, color: statusChartColors[status] },
    ]),
  ) satisfies ChartConfig

  const gradeChartData = grades.map((grade) => ({
    grade: gradeInfo[grade].label,
    key: grade,
    value: graded.filter((g) => g.grade === grade).length,
    fill: gradeHex[grade].light,
  }))
  const gradeChartConfig = Object.fromEntries(
    grades.map((grade) => [
      grade,
      { label: gradeInfo[grade].label, color: gradeHex[grade].light },
    ]),
  ) satisfies ChartConfig

  const warrantyPieData = (
    [
      { state: "Active", value: warrantyCounts.Active, fill: "var(--color-emerald-500)" },
      { state: "Expiring", value: warrantyCounts.Expiring, fill: "var(--color-amber-500)" },
      { state: "Expired", value: warrantyCounts.Expired, fill: "var(--color-red-500)" },
    ] as const
  ).filter((row) => row.value > 0)

  const attention = useMemo(() => {
    if (!today) return []
    const rows: Attention[] = []
    for (const laptop of laptops) {
      if (laptop.status === "In repair") {
        rows.push({
          href: "/dashboard/laptops",
          tag: laptop.assetTag,
          title: `${laptop.brand} ${laptop.model}`,
          reason: laptop.repairIssue?.trim() || "In repair",
          tone: "amber",
        })
      }
      if (laptop.status !== "Retired" && laptop.charger.condition === "Missing") {
        rows.push({
          href: "/dashboard/laptops",
          tag: laptop.assetTag,
          title: `${laptop.brand} ${laptop.model}`,
          reason: "Charger missing",
          tone: "red",
        })
      }
      if (laptop.status !== "Retired") {
        const warranty = warrantyInfo(laptop, today)
        if (warranty.state === "Expired") {
          rows.push({
            href: "/dashboard/laptops",
            tag: laptop.assetTag,
            title: `${laptop.brand} ${laptop.model}`,
            reason: "Warranty expired",
            tone: "red",
          })
        } else if (warranty.state === "Expiring") {
          rows.push({
            href: "/dashboard/analytics",
            tag: laptop.assetTag,
            title: `${laptop.brand} ${laptop.model}`,
            reason: "Warranty ends within 90 days",
            tone: "amber",
          })
        }
        const gradedLaptop = gradeLaptop(laptop, today)
        if (gradedLaptop.grade === "F" || gradedLaptop.grade === "D") {
          rows.push({
            href: "/dashboard/analytics",
            tag: laptop.assetTag,
            title: `${laptop.brand} ${laptop.model}`,
            reason: `${gradeInfo[gradedLaptop.grade].label} · ${gradeInfo[gradedLaptop.grade].action}`,
            tone: gradedLaptop.grade === "F" ? "red" : "amber",
          })
        }
      }
    }
    const seen = new Set<string>()
    return rows
      .filter((row) => {
        const key = `${row.tag}:${row.reason}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 8)
  }, [today, laptops])

  const activity = useMemo(() => {
    const rows: Activity[] = []
    for (const laptop of laptops) {
      for (const entry of laptop.history) {
        rows.push({
          key: `${laptop.id}:${entry.from}:${entry.note ?? ""}`,
          href: "/dashboard/laptops",
          tag: laptop.assetTag,
          title: `${laptop.brand} ${laptop.model}`,
          detail: entry.note?.trim()
            || (entry.handler ? `Assigned to ${entry.handler}` : "With IT"),
          when: entry.from,
        })
      }
    }
    for (const item of accessories) {
      const href = accessoryRoutes[item.kind]
      for (const entry of item.history) {
        rows.push({
          key: `${item.id}:${entry.from}:${entry.note ?? ""}`,
          href,
          tag: item.assetTag,
          title: `${item.brand} ${item.model}`,
          detail: entry.note?.trim()
            || (entry.handler ? `Assigned to ${entry.handler}` : "Back in stock"),
          when: entry.from,
        })
      }
    }
    return rows
      .sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
      .slice(0, 8)
  }, [laptops, accessories])

  const firstName = user.name.split(" ")[0]
  const inUseShare = deviceTotal ? statusTotals["In use"] / deviceTotal : 0

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {today ? formatDate(today) : " "}
          </p>
          <h1 className="flex flex-wrap items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight">
            Dashboard
            <span className="relative -translate-y-1 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-3.5 pl-3.5 text-sm font-normal tracking-normal text-muted-foreground shadow-sm">
              <span
                aria-hidden
                className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rotate-45 border-b border-l border-border bg-card"
              />
              <MessageCircleIcon className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 truncate">
                Welcome back, {firstName}.{" "}
                {hasFilters ? (
                  <>
                    <AnimatedNumber value={deviceTotal} /> of{" "}
                    <AnimatedNumber
                      value={allLaptops.length + allAccessories.length}
                    />{" "}
                    devices match these filters.
                  </>
                ) : (
                  <>
                    <AnimatedNumber value={deviceTotal} /> devices on hand ·{" "}
                    <AnimatedNumber
                      value={Math.round(inUseShare * 100)}
                      suffix="%"
                    />{" "}
                    in use.
                  </>
                )}
              </span>
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterMenu
            label="Department"
            icon={BuildingIcon}
            options={departments}
            selected={departmentFilter}
            onChange={setDepartmentFilter}
          />
          <FilterMenu
            label="Brand"
            icon={LaptopIcon}
            options={brands}
            selected={brandFilter}
            onChange={setBrandFilter}
          />
          <FilterMenu
            label="Grade"
            icon={AwardIcon}
            options={grades.map((g) => gradeInfo[g].label)}
            selected={gradeFilter.map((g) => gradeInfo[g].label)}
            onChange={(labels) =>
              setGradeFilter(grades.filter((g) => labels.includes(gradeInfo[g].label)))
            }
          />
          <FilterMenu
            label="Status"
            icon={CircleDotIcon}
            options={statuses}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <XIcon />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Bento grid: flat cells on a border-coloured background, so the 1px
          gaps between them read as dividers and every card feels connected. */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 lg:grid-cols-4">
          <Tile href="/dashboard/laptops">
            <TileHeader icon={PackageIcon} label="Vacant stock" hint="Ready" />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              <AnimatedNumber value={vacantTotal} delay={40} />
            </p>
            <MiniSpark data={vacantSpark} color="var(--color-sky-500)" />
            <p className="text-xs text-muted-foreground">
              <AnimatedNumber value={summary.laptops.Vacant} delay={40} /> laptops ·{" "}
              <AnimatedNumber
                value={vacantTotal - summary.laptops.Vacant}
                delay={40}
              />{" "}
              accessories
            </p>
          </Tile>
          <Tile href="/dashboard/laptops">
            <TileHeader icon={WrenchIcon} label="In repair" hint="Out of use" />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              <AnimatedNumber value={repairTotal} delay={120} />
            </p>
            <p className="text-xs text-muted-foreground">
              <AnimatedNumber value={summary.laptops["In repair"]} delay={120} />{" "}
              laptops waiting on a fix
            </p>
          </Tile>
          <Tile>
            <TileHeader
              icon={UserCheckIcon}
              label="Released"
              hint={
                <DateRangeFilter
                  label="This month"
                  value={dateRange}
                  onChange={setDateRange}
                  className="-my-1.5 h-7 px-2.5 text-xs"
                />
              }
            />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              <AnimatedNumber value={releases.total} delay={200} />
            </p>
            <MiniSpark data={assignSpark} color="var(--color-chart-2)" />
            <p className="text-xs text-muted-foreground">
              <AnimatedNumber value={releases.laptops} delay={200} /> laptops ·{" "}
              <AnimatedNumber value={releases.total - releases.laptops} delay={200} />{" "}
              accessories {dateRange ? "in these dates" : "since the 1st"}
            </p>
          </Tile>
          <Tile href="/dashboard/analytics">
            <TileHeader icon={ShieldCheckIcon} label="Fleet health" />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {fleetScore === null ? (
                "–"
              ) : (
                <AnimatedNumber value={fleetScore} delay={280} />
              )}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / 100
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {fleetScore !== null ? (
                <>
                  {gradeInfo[gradeForScore(fleetScore)].label} ·{" "}
                  <AnimatedNumber value={dueForReplacement} delay={280} /> due to
                  replace
                </>
              ) : (
                "No active laptops"
              )}
            </p>
          </Tile>

          {/* One row per asset type: stock on hand, and how many were
              released in the Released tile's period. */}
          <Tile className="gap-0 p-0 md:col-span-2 lg:col-span-4">
            <div className="px-4 pt-4 pb-3">
              <TileHeader
                icon={BoxesIcon}
                label="Assets"
                hint={dateRange ? "Released in these dates" : "Released this month"}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-xs">
                <thead>
                  <tr className="border-y border-border bg-muted/40 text-[11px] text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Asset</th>
                    <th className="w-[28%] px-4 py-2 text-left font-medium">On hand</th>
                    {assetStatusColumns.map((status) => (
                      <th key={status} className="px-4 py-2 text-right font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("size-1.5 rounded-full", statusStyles[status].dot)} />
                          {status}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right font-medium">Released</th>
                  </tr>
                </thead>
                <tbody>
                  {assetRows.map((row, i) => {
                    const Icon = row.icon
                    const empty = row.counts.total === 0 && row.released === 0
                    return (
                      <tr
                        key={row.key}
                        className={cn(
                          "border-b border-border last:border-b-0 hover:bg-muted/40",
                          empty && "text-muted-foreground opacity-60",
                        )}
                      >
                        <td className="px-4 py-2">
                          <Link
                            href={row.href}
                            className="flex items-center gap-2 font-medium hover:underline"
                          >
                            <Icon className="size-3.5 text-muted-foreground" />
                            {row.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-3">
                            <span className="w-8 text-sm font-semibold tabular-nums">
                              <AnimatedNumber value={row.counts.total} delay={360 + i * 40} />
                            </span>
                            <Meter
                              value={row.counts.total / maxOnHand}
                              className="bg-sky-500"
                            />
                          </span>
                        </td>
                        {assetStatusColumns.map((status) => (
                          <td key={status} className="px-4 py-2 text-right tabular-nums">
                            {row.counts[status] || (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-medium tabular-nums">
                          {row.released ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {row.released}
                            </span>
                          ) : (
                            <span className="font-normal text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Tile>

          <Tile className="md:col-span-2 lg:col-span-3">
            <TileHeader
              icon={TrendingUpIcon}
              label="Inventory and assignments"
              hint="Last 12 months"
            />
            <ChartContainer
              config={growthChartConfig}
              className="aspect-auto h-64 w-full"
            >
              <AreaChart data={growthData} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id={growthFillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={assignFillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid className="stroke-border" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={32}
                />
                <ChartTooltip
                  cursor={{ className: "stroke-foreground/20" }}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as
                      | { label: string; total: number; assigned: number }
                      | undefined
                    if (!active || !row) return null
                    return (
                      <TooltipBox>
                        <div className="font-medium">{row.label}</div>
                        <TooltipRow
                          color="var(--color-chart-1)"
                          label="On hand"
                          value={row.total}
                        />
                        <TooltipRow
                          color="var(--color-chart-2)"
                          label="Assigned that month"
                          value={row.assigned}
                        />
                      </TooltipBox>
                    )
                  }}
                />
                <Area
                  dataKey="total"
                  type="monotone"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill={`url(#${growthFillId})`}
                  animationDuration={900}
                  animationBegin={200}
                />
                <Area
                  dataKey="assigned"
                  type="monotone"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  fill={`url(#${assignFillId})`}
                  animationDuration={900}
                  animationBegin={280}
                />
              </AreaChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[var(--color-chart-1)]" />
                Devices on hand
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[var(--color-chart-2)]" />
                Assigned that month
              </span>
            </div>
          </Tile>

          <Tile>
            <TileHeader icon={PieChartIcon} label="Fleet by status" />
            <div className="relative">
              <ChartContainer
                config={statusChartConfig}
                className="aspect-auto mx-auto h-44 w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as
                        | { status: LaptopStatus; value: number; fill: string }
                        | undefined
                      if (!active || !row) return null
                      return (
                        <TooltipBox>
                          <TooltipRow
                            color={row.fill}
                            label={row.status}
                            value={`${row.value} · ${deviceTotal ? Math.round((row.value / deviceTotal) * 100) : 0}%`}
                          />
                        </TooltipBox>
                      )
                    }}
                  />
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                    animationDuration={900}
                    animationBegin={240}
                  >
                    {statusPieData.map((row) => (
                      <Cell key={row.status} fill={row.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">
                  <AnimatedNumber value={deviceTotal} delay={240} />
                </span>
                <span className="text-[11px] text-muted-foreground">devices</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-xs">
              {statusPieData.map((row) => (
                <div key={row.status} className="flex items-center gap-2">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: row.fill }}
                  />
                  <span className="text-muted-foreground">{row.status}</span>
                  <span className="ml-auto font-medium tabular-nums">
                    <AnimatedNumber value={row.value} delay={280} />
                  </span>
                </div>
              ))}
            </div>
          </Tile>

          <Tile className="md:col-span-2 lg:col-span-2">
            <TileHeader
              icon={BarChart3Icon}
              label="Status by category"
              hint="Stacked counts"
            />
            <ChartContainer
              config={stackedChartConfig}
              className="aspect-auto h-72 w-full"
            >
              <BarChart
                data={stackedCategoryData}
                margin={{ left: 0, right: 0, top: 8 }}
              >
                <CartesianGrid className="stroke-border" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={0}
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={28}
                />
                <ChartTooltip
                  cursor={{ className: "fill-muted" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <TooltipBox>
                        <div className="font-medium">{String(label)}</div>
                        {payload.map((item) => (
                          <TooltipRow
                            key={String(item.dataKey)}
                            color={String(item.color)}
                            label={String(item.dataKey)}
                            value={Number(item.value ?? 0)}
                          />
                        ))}
                      </TooltipBox>
                    )
                  }}
                />
                {statuses.map((status) => (
                  <Bar
                    key={status}
                    dataKey={status}
                    stackId="status"
                    fill={statusChartColors[status]}
                    maxBarSize={36}
                    animationDuration={900}
                    animationBegin={200}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {statuses.map((status) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: statusChartColors[status] }}
                  />
                  {status}
                </span>
              ))}
            </div>
          </Tile>

          <div className="grid gap-px md:col-span-2 lg:col-span-2">
            <Tile href="/dashboard/analytics">
              <TileHeader icon={AwardIcon} label="Laptop grades" />
              <ChartContainer
                config={gradeChartConfig}
                className="aspect-auto h-40 w-full"
              >
                <BarChart
                  data={gradeChartData}
                  layout="vertical"
                  margin={{ left: 8, right: 12, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="grade"
                    tickLine={false}
                    axisLine={false}
                    width={78}
                    fontSize={11}
                  />
                  <ChartTooltip
                    cursor={{ className: "fill-muted" }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as
                        | { grade: string; value: number; fill: string }
                        | undefined
                      if (!active || !row) return null
                      return (
                        <TooltipBox>
                          <TooltipRow
                            color={row.fill}
                            label={row.grade}
                            value={row.value}
                          />
                        </TooltipBox>
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16} animationDuration={900} animationBegin={280}>
                    {gradeChartData.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </Tile>
            <Tile href="/dashboard/laptops">
              <TileHeader icon={ClockIcon} label="Laptop warranty" />
              <div className="flex items-center gap-4">
                <ChartContainer
                  config={{
                    Active: { label: "Active", color: "var(--color-emerald-500)" },
                    Expiring: { label: "Expiring", color: "var(--color-amber-500)" },
                    Expired: { label: "Expired", color: "var(--color-red-500)" },
                  }}
                  className="aspect-auto h-24 w-24 shrink-0"
                >
                  <PieChart>
                    <Pie
                      data={warrantyPieData}
                      dataKey="value"
                      nameKey="state"
                      innerRadius={28}
                      outerRadius={40}
                      paddingAngle={2}
                      strokeWidth={0}
                      animationDuration={900}
                      animationBegin={320}
                    >
                      {warrantyPieData.map((row) => (
                        <Cell key={row.state} fill={row.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <span className={cn("flex items-center gap-1.5", warrantyStyles.Expiring.text)}>
                    <span className={cn("size-1.5 rounded-full", warrantyStyles.Expiring.dot)} />
                    <AnimatedNumber value={warrantyCounts.Expiring} delay={320} />{" "}
                    expiring soon
                  </span>
                  <span className={cn("flex items-center gap-1.5", warrantyStyles.Expired.text)}>
                    <span className={cn("size-1.5 rounded-full", warrantyStyles.Expired.dot)} />
                    <AnimatedNumber value={warrantyCounts.Expired} delay={320} />{" "}
                    expired
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Active laptops · soon is within 90 days
                  </span>
                </div>
              </div>
            </Tile>
          </div>

          <Tile className="md:col-span-2 lg:col-span-2">
            <TileHeader
              icon={TriangleAlertIcon}
              label="Needs attention"
              hint={
                <AnimatedNumber value={attention.length} delay={400} />
              }
            />
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing urgent in the current filters.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {attention.map((row) => (
                  <li key={`${row.tag}:${row.reason}`}>
                    <Link
                      href={row.href}
                      className="flex items-start gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          row.tone === "red" && "bg-red-500",
                          row.tone === "amber" && "bg-amber-500",
                          row.tone === "sky" && "bg-sky-500",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          <span className="font-mono text-xs">{row.tag}</span>{" "}
                          <span className="font-normal text-muted-foreground">
                            {row.title}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.reason}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {missingChargers.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <AnimatedNumber value={missingChargers.length} delay={400} /> laptop
                {missingChargers.length === 1 ? "" : "s"} missing a charger
              </p>
            )}
          </Tile>

          <Tile>
            <TileHeader icon={ClockIcon} label="Recent movement" />
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history in this view.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {activity.map((row) => (
                  <li key={row.key}>
                    <Link
                      href={row.href}
                      className="flex items-start justify-between gap-3 rounded-lg px-1 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-medium">
                          {row.tag}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.detail}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {row.when.slice(5)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tile>

          <Tile>
            <TileHeader icon={Building2Icon} label="Top departments" />
            {departmentChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No department data yet.</p>
            ) : (
              <ChartContainer
                config={{ value: { label: "Assets", color: "var(--color-chart-1)" } }}
                className="aspect-auto h-56 w-full"
              >
                <BarChart
                  data={departmentChartData}
                  layout="vertical"
                  margin={{ left: 4, right: 12, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="department"
                    tickLine={false}
                    axisLine={false}
                    width={88}
                    fontSize={11}
                  />
                  <ChartTooltip
                    cursor={{ className: "fill-muted" }}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as
                        | { department: string; value: number }
                        | undefined
                      if (!active || !row) return null
                      return (
                        <TooltipBox>
                          <TooltipRow label={row.department} value={row.value} />
                        </TooltipBox>
                      )
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--color-chart-1)"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={14}
                    animationDuration={900}
                    animationBegin={360}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </Tile>

          <Tile href="/dashboard/laptops" className="md:col-span-2 lg:col-span-2">
            <TileHeader icon={LaptopIcon} label="Laptop brands" />
            {brandChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No laptops in this view.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {brandChartData.map((row) => (
                  <div key={row.brand} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 truncate text-muted-foreground">
                      {row.brand}
                    </span>
                    <Meter
                      value={
                        summary.laptops.total ? row.value / summary.laptops.total : 0
                      }
                    />
                    <span className="w-6 shrink-0 text-right font-medium tabular-nums">
                      <AnimatedNumber value={row.value} delay={420} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Tile>
          <Tile href="/dashboard/remote-access">
            <TileHeader icon={WifiIcon} label="Remote access" />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              <AnimatedNumber
                value={Math.round(remoteCoverage * 100)}
                delay={440}
                suffix="%"
              />
            </p>
            <Meter value={remoteCoverage} />
            <p className="text-xs text-muted-foreground">
              <AnimatedNumber value={remoteConfigured} delay={440} /> of{" "}
              <AnimatedNumber value={assignedLaptops.length} delay={440} /> assigned
              laptops have AnyDesk
            </p>
          </Tile>
          <Tile href="/dashboard/users">
            <TileHeader icon={UsersIcon} label="Portal users" />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              <AnimatedNumber value={users.length} delay={480} />
            </p>
            <p className="text-sm text-muted-foreground">
              <AnimatedNumber value={activeUsers.length} delay={480} /> active ·{" "}
              <AnimatedNumber value={adminUsers.length} delay={480} /> admin
              {adminUsers.length === 1 ? "" : "s"}
            </p>
          </Tile>
        </div>
      </div>
    </div>
  )
}

function gradeForScore(score: number) {
  return grades.find((g) => score >= gradeInfo[g].min) ?? "F"
}
