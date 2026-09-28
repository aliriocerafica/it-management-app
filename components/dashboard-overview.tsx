"use client"

import Link from "next/link"
import { useMemo, type ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  BackpackIcon,
  BarChart3Icon,
  Building2Icon,
  ClockIcon,
  HeadphonesIcon,
  LaptopIcon,
  MouseIcon,
  PackageIcon,
  PieChartIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  TvMinimalIcon,
  UserCheckIcon,
  UsersIcon,
  WifiIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import type { Accessory, AccessoryKind } from "@/lib/accessories"
import { accessoryConfigs } from "@/lib/accessories"
import { grades, gradeInfo, gradeLaptop, average } from "@/lib/laptop-analytics"
import type { InventorySummary } from "@/lib/inventory-map"
import {
  formatDate,
  parseDate,
  statusStyles,
  statuses,
  warrantyInfo,
  type Laptop,
  type LaptopStatus,
} from "@/lib/laptops"
import { useToday } from "@/lib/use-today"
import type { SessionUser } from "@/lib/auth/dto"
import type { UserDto } from "@/lib/user-repository"
import { cn } from "@/lib/utils"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"

const accessoryRoutes: Record<AccessoryKind, string> = {
  headset: "/dashboard/headsets",
  mouse: "/dashboard/mice",
  monitor: "/dashboard/monitors",
  bag: "/dashboard/laptop-bags",
}

const accessoryIcons: Record<AccessoryKind, LucideIcon> = {
  headset: HeadphonesIcon,
  mouse: MouseIcon,
  monitor: TvMinimalIcon,
  bag: BackpackIcon,
}

const warrantyStyles = {
  Active: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  Expiring: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  Expired: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
} as const

// Reuse the same semantic colors as the status dots/badges elsewhere in the app.
const statusChartColors: Record<LaptopStatus, string> = {
  "In use": "var(--color-emerald-500)",
  Vacant: "var(--color-sky-500)",
  "In repair": "var(--color-amber-500)",
  Retired: "var(--color-red-500)",
}

function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {children}
    </div>
  )
}

function TooltipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {color && <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-mono font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

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
    "flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm",
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

function TileHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground">
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full bg-foreground", className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function DashboardOverview({
  user,
  summary,
  laptops,
  accessories,
  users,
}: {
  user: SessionUser
  summary: InventorySummary
  laptops: Laptop[]
  accessories: Accessory[]
  users: UserDto[]
}) {
  const today = useToday()

  const categories = (Object.keys(accessoryConfigs) as AccessoryKind[]).map((kind) => ({
    kind,
    title: accessoryConfigs[kind].plural,
    href: accessoryRoutes[kind],
    icon: accessoryIcons[kind],
    counts: summary[kind],
  }))

  const vacantTotal =
    summary.laptops.Vacant +
    categories.reduce((sum, c) => sum + c.counts.Vacant, 0)
  const repairTotal =
    summary.laptops["In repair"] +
    categories.reduce((sum, c) => sum + c.counts["In repair"], 0)
  const deviceTotal =
    summary.laptops.total + categories.reduce((sum, c) => sum + c.counts.total, 0)

  // Fleet health, reusing the exact grading logic from the analytics page.
  const graded = useMemo(() => {
    if (!today) return []
    return laptops.filter((l) => l.status !== "Retired").map((l) => gradeLaptop(l, today))
  }, [today, laptops])
  const fleetScore = graded.length ? Math.round(average(graded.map((g) => g.score))) : null
  const dueForReplacement = graded.filter((g) => g.grade === "D" || g.grade === "F").length

  // Warranty, across every laptop and accessory.
  const warrantyCounts = useMemo(() => {
    const counts = { Active: 0, Expiring: 0, Expired: 0 }
    if (!today) return counts
    for (const item of [...laptops, ...accessories]) {
      counts[warrantyInfo(item, today).state] += 1
    }
    return counts
  }, [today, laptops, accessories])

  // Assets released (assigned to a handler) so far this calendar month.
  const releasedThisMonth = useMemo(() => {
    if (!today) return 0
    let count = 0
    for (const item of [...laptops, ...accessories]) {
      for (const entry of item.history) {
        if (!entry.handler) continue
        const from = parseDate(entry.from)
        if (from.getFullYear() === today.getFullYear() && from.getMonth() === today.getMonth()) {
          count++
        }
      }
    }
    return count
  }, [today, laptops, accessories])

  // Remote access: laptops with an AnyDesk address configured.
  const remoteConfigured = laptops.filter((l) => l.anydeskAddress).length
  const remoteCoverage = laptops.length ? remoteConfigured / laptops.length : 0

  // Departments, across laptops and accessories combined.
  const departmentCounts = new Map<string, number>()
  for (const item of [...laptops, ...accessories]) {
    if (!item.department) continue
    departmentCounts.set(item.department, (departmentCounts.get(item.department) ?? 0) + 1)
  }
  const topDepartments = [...departmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxDeptCount = topDepartments[0]?.[1] ?? 1

  const activeUsers = users.filter((u) => u.isActive)
  const adminUsers = users.filter((u) => u.role === "ADMIN")

  // Cumulative devices acquired, one point per month for the last 12 months.
  const growthData = useMemo(() => {
    if (!today) return []
    const items = [...laptops, ...accessories]
    const points: { label: string; total: number }[] = []
    for (let offset = -11; offset <= 0; offset++) {
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0)
      const total = items.filter((item) => parseDate(item.purchaseDate) <= monthEnd).length
      points.push({ label: monthEnd.toLocaleDateString("en-GB", { month: "short" }), total })
    }
    return points
  }, [today, laptops, accessories])
  const growthChartConfig = { total: { label: "Devices" } } satisfies ChartConfig

  // Devices by status, across laptops and every accessory category.
  const statusTotals = statuses.reduce(
    (acc, status) => {
      acc[status] = summary.laptops[status] + categories.reduce((s, c) => s + c.counts[status], 0)
      return acc
    },
    {} as Record<LaptopStatus, number>,
  )
  const statusPieData = statuses
    .map((status) => ({ status, value: statusTotals[status], fill: statusChartColors[status] }))
    .filter((row) => row.value > 0)
  const statusChartConfig = Object.fromEntries(
    statuses.map((status) => [status, { label: status, color: statusChartColors[status] }]),
  ) satisfies ChartConfig

  // Devices by category (laptops + each accessory kind).
  const categoryBarData = [
    { label: "Laptops", value: summary.laptops.total },
    ...categories.map((c) => ({ label: c.title, value: c.counts.total })),
  ]
  const categoryChartConfig = { value: { label: "Devices" } } satisfies ChartConfig

  return (
    <div className="flex flex-col gap-4">
      {/* Welcome + top-line counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile className="sm:col-span-2 lg:col-span-2">
          <p className="text-sm text-muted-foreground">{today ? formatDate(today) : " "}</p>
          <p className="font-heading text-xl font-semibold tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </p>
          <p className="text-sm text-muted-foreground">
            {deviceTotal} devices tracked across the portal.
          </p>
        </Tile>
        <Tile href="/dashboard/laptops">
          <TileHeader icon={LaptopIcon} label="Vacant devices" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{vacantTotal}</p>
          <p className="text-sm text-muted-foreground">Ready to assign</p>
        </Tile>
        <Tile href="/dashboard/laptops">
          <TileHeader icon={WrenchIcon} label="In repair" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{repairTotal}</p>
          <p className="text-sm text-muted-foreground">Out of circulation</p>
        </Tile>
      </div>

      {/* Total assets and this month's activity */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile>
          <TileHeader icon={PackageIcon} label="Total assets" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{deviceTotal}</p>
          <p className="text-sm text-muted-foreground">Laptops and accessories combined</p>
        </Tile>
        <Tile>
          <TileHeader icon={UserCheckIcon} label="Released this month" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{releasedThisMonth}</p>
          <p className="text-sm text-muted-foreground">Assets assigned to staff since the 1st</p>
        </Tile>
      </div>

      {/* Health, warranty, and remote access */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile href="/dashboard/analytics">
          <TileHeader icon={ShieldCheckIcon} label="Fleet health score" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {fleetScore ?? "–"}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {fleetScore !== null ? gradeInfo[gradeForScore(fleetScore)].label : "No active laptops"}
          </p>
        </Tile>
        <Tile href="/dashboard/analytics">
          <TileHeader icon={WrenchIcon} label="Due for replacement" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{dueForReplacement}</p>
          <p className="text-sm text-muted-foreground">Grade D or F laptops</p>
        </Tile>
        <Tile href="/dashboard/laptops">
          <TileHeader icon={ClockIcon} label="Warranty" />
          <div className="flex flex-col gap-1 text-sm">
            <span className={cn("flex items-center gap-1.5", warrantyStyles.Expiring.text)}>
              <span className={cn("size-1.5 rounded-full", warrantyStyles.Expiring.dot)} />
              {warrantyCounts.Expiring} expiring soon
            </span>
            <span className={cn("flex items-center gap-1.5", warrantyStyles.Expired.text)}>
              <span className={cn("size-1.5 rounded-full", warrantyStyles.Expired.dot)} />
              {warrantyCounts.Expired} expired
            </span>
          </div>
        </Tile>
        <Tile href="/dashboard/remote-access">
          <TileHeader icon={WifiIcon} label="Remote access coverage" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {Math.round(remoteCoverage * 100)}%
          </p>
          <Meter value={remoteCoverage} />
          <p className="text-xs text-muted-foreground">
            {remoteConfigured} of {laptops.length} laptops configured
          </p>
        </Tile>
      </div>

      {/* Inventory by category */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile href="/dashboard/laptops" className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
          <TileHeader icon={LaptopIcon} label="Laptops" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {summary.laptops.total}
          </p>
          <Meter
            value={summary.laptops.total ? summary.laptops["In use"] / summary.laptops.total : 0}
          />
          <div className="mt-1 flex flex-col gap-1.5 text-xs text-muted-foreground">
            {statuses.map((status) => (
              <span key={status} className="grid grid-cols-[auto_1.5rem_1fr] items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", statusStyles[status].dot)} />
                <span className="text-right font-medium text-foreground tabular-nums">
                  {summary.laptops[status]}
                </span>
                {status.toLowerCase()}
              </span>
            ))}
          </div>
        </Tile>
        {categories.map((category) => (
          <Tile key={category.kind} href={category.href}>
            <TileHeader icon={category.icon} label={category.title} />
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {category.counts.total}
            </p>
            <p className="text-sm text-muted-foreground">{category.counts.Vacant} vacant</p>
          </Tile>
        ))}
      </div>

      {/* Departments and portal users */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile>
          <TileHeader icon={Building2Icon} label="Top departments by equipment" />
          <div className="flex flex-col gap-2.5">
            {topDepartments.length === 0 && (
              <p className="text-sm text-muted-foreground">No department data yet.</p>
            )}
            {topDepartments.map(([department, count]) => (
              <div key={department} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate text-muted-foreground">{department}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${(count / maxDeptCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </Tile>
        <Tile href="/dashboard/users">
          <TileHeader icon={UsersIcon} label="Portal users" />
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{users.length}</p>
          <p className="text-sm text-muted-foreground">
            {activeUsers.length} active · {adminUsers.length} admin
            {adminUsers.length === 1 ? "" : "s"}
          </p>
        </Tile>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Tile className="lg:col-span-2">
          <TileHeader icon={TrendingUpIcon} label="Inventory growth (12 months)" />
          <ChartContainer config={growthChartConfig} className="aspect-auto h-56 w-full">
            <LineChart data={growthData} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid className="stroke-border" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={4} width={28} />
              <ChartTooltip
                cursor={{ className: "stroke-foreground/30" }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as { label: string; total: number } | undefined
                  if (!active || !row) return null
                  return (
                    <TooltipBox>
                      <div className="font-medium">{row.label}</div>
                      <TooltipRow label="Devices" value={row.total} />
                    </TooltipBox>
                  )
                }}
              />
              <Line
                dataKey="total"
                type="monotone"
                stroke="var(--foreground)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, className: "stroke-background" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </Tile>

        <Tile>
          <TileHeader icon={PieChartIcon} label="Devices by status" />
          <ChartContainer config={statusChartConfig} className="aspect-auto h-40 w-full">
            <PieChart>
              <ChartTooltip
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as
                    | { status: LaptopStatus; value: number; fill: string }
                    | undefined
                  if (!active || !row) return null
                  return (
                    <TooltipBox>
                      <TooltipRow color={row.fill} label={row.status} value={row.value} />
                    </TooltipBox>
                  )
                }}
              />
              <Pie
                data={statusPieData}
                dataKey="value"
                nameKey="status"
                innerRadius={38}
                outerRadius={62}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {statusPieData.map((row) => (
                  <Cell key={row.status} fill={row.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {statusPieData.map((row) => (
              <span key={row.status} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: row.fill }} />
                {row.status} ({row.value})
              </span>
            ))}
          </div>
        </Tile>
      </div>

      <Tile>
        <TileHeader icon={BarChart3Icon} label="Devices by category" />
        <ChartContainer config={categoryChartConfig} className="aspect-auto h-56 w-full">
          <BarChart data={categoryBarData} margin={{ left: 0, right: 0, top: 20 }}>
            <CartesianGrid className="stroke-border" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              fontSize={11}
            />
            <ChartTooltip
              cursor={{ className: "fill-muted" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as { label: string; value: number } | undefined
                if (!active || !row) return null
                return (
                  <TooltipBox>
                    <TooltipRow label={row.label} value={row.value} />
                  </TooltipBox>
                )
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} fill="var(--foreground)">
              <LabelList
                dataKey="value"
                position="top"
                offset={6}
                className="fill-foreground text-xs font-medium"
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </Tile>
    </div>
  )
}

function gradeForScore(score: number) {
  return grades.find((g) => score >= gradeInfo[g].min) ?? "F"
}
