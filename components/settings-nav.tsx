"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PaletteIcon, UserIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const items = [
  {
    href: "/dashboard/settings",
    label: "Preferences",
    icon: PaletteIcon,
    exact: true,
  },
  {
    href: "/dashboard/settings/profile",
    label: "Profile",
    icon: UserIcon,
    exact: false,
  },
] as const

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Settings"
      className="flex flex-wrap gap-1 rounded-xl bg-muted/70 p-1 dark:bg-muted/40"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
