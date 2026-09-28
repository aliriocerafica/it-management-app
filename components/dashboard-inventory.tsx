"use client"

import Link from "next/link"
import {
  BackpackIcon,
  HeadphonesIcon,
  LaptopIcon,
  MouseIcon,
  TvMinimalIcon,
  type LucideIcon,
} from "lucide-react"

import { accessoryConfigs, type AccessoryKind } from "@/lib/accessories"
import type { InventorySummary } from "@/lib/inventory-map"
import { statusStyles, statuses } from "@/lib/laptops"
import { cn } from "@/lib/utils"

type Category = {
  title: string
  href: string
  icon: LucideIcon
  key: "laptops" | AccessoryKind
}

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

const categories: Category[] = [
  {
    title: "Laptops",
    href: "/dashboard/laptops",
    icon: LaptopIcon,
    key: "laptops",
  },
  ...(Object.keys(accessoryConfigs) as AccessoryKind[]).map((kind) => ({
    title: accessoryConfigs[kind].plural,
    href: accessoryRoutes[kind],
    icon: accessoryIcons[kind],
    key: kind,
  })),
]

export function DashboardInventory({ summary }: { summary: InventorySummary }) {
  const categoryStats = categories.map((category) => {
    const stats = summary[category.key]
    return {
      ...category,
      total: stats.total,
      counts: stats,
    }
  })
  const vacantTotal = categoryStats.reduce(
    (sum, category) => sum + category.counts.Vacant,
    0,
  )
  const repairTotal = categoryStats.reduce(
    (sum, category) => sum + category.counts["In repair"],
    0,
  )
  const deviceTotal = categoryStats.reduce(
    (sum, category) => sum + category.total,
    0,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
          <SummaryCell
            label="Vacant devices"
            value={vacantTotal}
            hint="Ready to assign"
            accent={statusStyles.Vacant}
          />
          <SummaryCell
            label="In repair"
            value={repairTotal}
            hint="Out of circulation"
            accent={statusStyles["In repair"]}
          />
          <SummaryCell
            label="Total inventory"
            value={deviceTotal}
            hint={`${categoryStats.length} device types`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-5">
          {categoryStats.map((category) => {
            const Icon = category.icon
            return (
              <Link
                key={category.href}
                href={category.href}
                className="flex h-full flex-col justify-between gap-4 bg-background p-4 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs tracking-wide text-muted-foreground">
                    <Icon className="size-3.5" />
                    {category.title}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {category.total} total
                  </span>
                </div>
                <div className="flex min-h-24 flex-1 items-stretch justify-between gap-4">
                  <div className="flex flex-col justify-between">
                    <p className="text-3xl font-semibold tracking-tight tabular-nums">
                      {category.counts.Vacant}
                    </p>
                    <p className="text-sm text-muted-foreground">vacant</p>
                  </div>
                  <div className="flex flex-col justify-between text-xs text-muted-foreground">
                    {statuses.map((status) => (
                      <span
                        key={status}
                        className="grid grid-cols-[auto_1.5rem_1fr] items-center gap-1.5"
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            statusStyles[status].dot,
                          )}
                        />
                        <span className="text-right font-medium text-foreground tabular-nums">
                          {category.counts[status]}
                        </span>
                        {status.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SummaryCell({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number
  hint: string
  accent?: { dot: string; text: string }
}) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          accent?.text,
        )}
      >
        {value}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {accent && <span className={cn("size-1.5 rounded-full", accent.dot)} />}
        {hint}
      </p>
    </div>
  )
}
