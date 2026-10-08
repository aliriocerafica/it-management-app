"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BackpackIcon,
  BatteryIcon,
  KeyboardIcon,
  BoxesIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  FileTextIcon,
  ChevronLeftIcon,
  HeadphonesIcon,
  KeyRoundIcon,
  LaptopIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MemoryStickIcon,
  MouseIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  TvMinimalIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { AnyDeskIcon } from "@/components/anydesk-icon"
import { ThemeSwitch } from "@/components/theme-switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { fetchPendingRequestCount } from "@/app/actions/pending-request-count"
import { fetchVacantCounts } from "@/app/actions/vacant-counts"
import { accessoryConfigs, lowerNoun } from "@/lib/accessories"
import { INVENTORY_CHANGED } from "@/lib/inventory-api"
import type { VacantCounts } from "@/lib/inventory-map"
import { cn } from "@/lib/utils"
import type { SessionUser } from "@/lib/auth/dto"

type NavItem = {
  title: string
  href: string
  icon: LucideIcon | ComponentType<{ className?: string }>
  vacantKey?: keyof VacantCounts
  pendingBadge?: boolean
  badge?: string
  action?: boolean
}

type NavGroup = {
  id: string
  title: string
  icon: LucideIcon
  items: NavItem[]
}

const dashboardItem: NavItem = {
  title: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboardIcon,
}

const navGroups: NavGroup[] = [
  {
    id: "inventory",
    title: "Inventory",
    icon: BoxesIcon,
    items: [
      {
        title: "Laptop Inventory",
        href: "/dashboard/laptops",
        icon: LaptopIcon,
        vacantKey: "laptops",
      },
      {
        title: "Headsets",
        href: "/dashboard/headsets",
        icon: HeadphonesIcon,
        vacantKey: "headset",
      },
      {
        title: "Mice",
        href: "/dashboard/mice",
        icon: MouseIcon,
        vacantKey: "mouse",
      },
      {
        title: "Keyboards",
        href: "/dashboard/keyboards",
        icon: KeyboardIcon,
        vacantKey: "keyboard",
      },
      {
        title: "Monitors",
        href: "/dashboard/monitors",
        icon: TvMinimalIcon,
        vacantKey: "monitor",
      },
      {
        title: "Laptop Bags",
        href: "/dashboard/laptop-bags",
        icon: BackpackIcon,
        vacantKey: "bag",
      },
      {
        title: "Batteries",
        href: "/dashboard/batteries",
        icon: BatteryIcon,
        vacantKey: "battery",
      },
      {
        title: "RAM",
        href: "/dashboard/ram",
        icon: MemoryStickIcon,
        vacantKey: "ram",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    icon: LayersIcon,
    items: [
      {
        title: "Remote Access",
        href: "/dashboard/remote-access",
        icon: AnyDeskIcon,
      },
      {
        title: "Laptop Analytics",
        href: "/dashboard/analytics",
        icon: ChartColumnIcon,
      },
      {
        title: "Accountability",
        href: "/dashboard/accountability",
        icon: FileTextIcon,
      },
      {
        title: "IT Asset Requests",
        href: "/dashboard/requests",
        icon: ClipboardListIcon,
        pendingBadge: true,
      },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    icon: ShieldIcon,
    items: [
      { title: "Users", href: "/dashboard/users", icon: UsersIcon },
      { title: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
    ],
  },
]

const countBadgeClass =
  "flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white tabular-nums"

function vacantNoun(key: keyof VacantCounts) {
  if (key === "laptops") return "laptops"
  return lowerNoun(accessoryConfigs[key].plural)
}

function withBadge(
  item: NavItem,
  vacantCounts: VacantCounts,
  pendingRequestCount: number,
): NavItem {
  if (item.pendingBadge) {
    return pendingRequestCount > 0
      ? { ...item, badge: String(pendingRequestCount) }
      : item
  }
  if (!item.vacantKey) return item
  const count = vacantCounts[item.vacantKey]
  return count > 0 ? { ...item, badge: String(count) } : item
}

function badgeTotal(items: NavItem[]) {
  const total = items.reduce(
    (sum, item) => sum + (item.badge ? Number(item.badge) : 0),
    0,
  )
  return total > 0 ? String(total) : undefined
}

function groupBadgeLabel(items: NavItem[], total: string) {
  const pending = items.some((item) => item.pendingBadge && item.badge)
  const vacant = items.some((item) => item.vacantKey && item.badge)
  if (pending && !vacant) return `${total} pending requests`
  if (vacant && !pending) return `${total} vacant items`
  return `${total} updates`
}

function NavCount({ item, floating }: { item: NavItem; floating?: boolean }) {
  if (!item.badge) return null
  return (
    <span
      aria-label={
        item.pendingBadge
          ? `${item.badge} pending requests`
          : item.vacantKey
            ? `${item.badge} vacant ${vacantNoun(item.vacantKey)}`
            : undefined
      }
      className={cn(
        countBadgeClass,
        floating && "absolute top-0.5 right-1 h-4 min-w-4 px-0.5 text-[9px]",
      )}
    >
      {item.badge}
    </span>
  )
}

function SidebarLink({
  item,
  pathname,
  collapsed = false,
  nested = false,
}: {
  item: NavItem
  pathname: string
  collapsed?: boolean
  nested?: boolean
}) {
  const isActive = pathname === item.href
  return (
    <div className="relative">
      {isActive && (
        <span className="absolute top-1/2 left-0 h-4 w-1 -translate-y-1/2 rounded-full bg-neutral-900 dark:bg-white" />
      )}
      <Link
        href={item.href}
        title={
          collapsed
            ? item.badge
              ? `${item.title} · ${item.badge} ${item.pendingBadge ? "pending" : "vacant"}`
              : item.title
            : undefined
        }
        className={cn(
          "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
          nested ? "h-9 px-2.5" : "h-10 rounded-xl px-3",
          collapsed && "justify-center rounded-xl px-0",
          isActive
            ? "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <item.icon
          className={cn(
            "size-4 shrink-0",
            isActive && "text-neutral-900 dark:text-white",
          )}
        />
        <span className={cn("flex-1 truncate", collapsed && "sr-only")}>
          {item.title}
        </span>
        <NavCount item={item} floating={collapsed} />
        {item.action && (
          <button
            type="button"
            className={cn(
              "flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              collapsed && "hidden",
            )}
            aria-label={`Add ${item.title}`}
            onClick={(event) => event.preventDefault()}
          >
            <PlusIcon className="size-3" />
          </button>
        )}
      </Link>
    </div>
  )
}

function NavGroupMenu({
  group,
  pathname,
  collapsed,
  open,
  onOpenChange,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const childActive = group.items.some((item) => item.href === pathname)
  const total = badgeTotal(group.items)
  const totalLabel = total ? groupBadgeLabel(group.items, total) : undefined

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={totalLabel ? `${group.title}, ${totalLabel}` : group.title}
          title={group.title}
          className={cn(
            "relative flex h-10 w-full items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground",
            childActive &&
              "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white",
          )}
        >
          <group.icon className="size-4 shrink-0" />
          {total && (
            <span
              aria-label={totalLabel}
              className="absolute top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-0.5 text-[9px] font-semibold text-white tabular-nums"
            >
              {total}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={14}
          className="w-64 overflow-hidden rounded-2xl p-0 shadow-lg"
        >
          <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
              <group.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{group.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {group.items.length}{" "}
                {group.items.length === 1 ? "page" : "pages"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 p-1.5">
            {group.items.map((item) => {
              const isActive = pathname === item.href
              return (
                <DropdownMenuItem
                  key={item.href}
                  render={<Link href={item.href} />}
                  className={cn(
                    "h-9 cursor-pointer gap-2.5 rounded-lg px-2 font-medium",
                    isActive
                      ? "bg-neutral-900/5 text-neutral-900 focus:bg-neutral-900/5 focus:text-neutral-900 dark:bg-white/10 dark:text-white dark:focus:bg-white/10 dark:focus:text-white"
                      : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <NavCount item={item} />
                </DropdownMenuItem>
              )
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`nav-group-${group.id}`}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          open || childActive
            ? "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <group.icon className="size-4 shrink-0" />
        <span className="flex-1 truncate">{group.title}</span>
        {!open && total && (
          <span aria-label={totalLabel} className={countBadgeClass}>
            {total}
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180 text-foreground",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          id={`nav-group-${group.id}`}
          inert={open ? undefined : true}
          className="overflow-hidden"
        >
          <div className="mt-1 flex flex-col gap-0.5 rounded-xl border border-sidebar-border/80 bg-muted/50 p-1 dark:bg-white/5">
            {group.items.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                nested
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({
  user,
  vacantCounts: initialVacantCounts,
  pendingRequestCount: initialPendingRequestCount,
}: {
  user: SessionUser
  vacantCounts: VacantCounts
  pendingRequestCount: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"
  const initial = user.name.trim()[0]?.toUpperCase() ?? "?"
  const [search, setSearch] = useState("")
  const activeGroupId =
    navGroups.find((group) =>
      group.items.some((item) => item.href === pathname),
    )?.id ?? null
  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId)
  const [vacantCounts, setVacantCounts] = useState(initialVacantCounts)
  const [pendingRequestCount, setPendingRequestCount] = useState(
    initialPendingRequestCount,
  )

  useEffect(() => {
    setVacantCounts(initialVacantCounts)
  }, [initialVacantCounts])

  useEffect(() => {
    setPendingRequestCount(initialPendingRequestCount)
  }, [initialPendingRequestCount])

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const [counts, pending] = await Promise.all([
        fetchVacantCounts(),
        fetchPendingRequestCount(),
      ])
      if (!cancelled) {
        setVacantCounts(counts)
        setPendingRequestCount(pending)
      }
    }

    void refresh()
    window.addEventListener(INVENTORY_CHANGED, refresh)
    return () => {
      cancelled = true
      window.removeEventListener(INVENTORY_CHANGED, refresh)
    }
  }, [pathname])

  const query = search.trim().toLowerCase()

  useEffect(() => {
    if (activeGroupId) setOpenGroupId(activeGroupId)
  }, [activeGroupId])

  const visibleGroups = useMemo(() => {
    return navGroups
      .map((group) => {
        const items = group.items.map((item) =>
          withBadge(item, vacantCounts, pendingRequestCount),
        )
        if (!query || group.title.toLowerCase().includes(query)) {
          return { ...group, items }
        }
        return {
          ...group,
          items: items.filter((item) =>
            item.title.toLowerCase().includes(query),
          ),
        }
      })
      .filter((group) => group.items.length > 0)
  }, [query, vacantCounts, pendingRequestCount])

  const showDashboard =
    !query || dashboardItem.title.toLowerCase().includes(query)

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-7 -right-3 z-20 hidden size-6 items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none md:flex"
      >
        <ChevronLeftIcon
          className={cn(
            "size-3.5 transition-transform duration-200",
            collapsed && "rotate-180"
          )}
        />
      </button>

      <SidebarHeader className="gap-4 p-4 group-data-[collapsible=icon]:px-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-2xl p-1 text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <Avatar className="size-11 shrink-0 after:rounded-full group-data-[collapsible=icon]:size-10">
              <AvatarFallback className="bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-base font-semibold text-sidebar-foreground">
                {user.name}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                IT Portal
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-xl"
            side="bottom"
            align="start"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
                <KeyRoundIcon />
                Change password
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOutIcon />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="relative group-data-[collapsible=icon]:hidden"
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search pages"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoComplete="off"
            aria-label="Search pages"
            className="h-10 rounded-xl border-0 bg-muted/70 pl-9 shadow-none focus-visible:ring-2 dark:bg-muted/40"
          />
        </form>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 group-data-[collapsible=icon]:px-2">
        <nav className="flex flex-col gap-1 px-1 pb-3 group-data-[collapsible=icon]:px-0">
          {!showDashboard && visibleGroups.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No results for &ldquo;{search}&rdquo;
            </p>
          )}
          {showDashboard && (
            <SidebarLink
              item={dashboardItem}
              pathname={pathname}
              collapsed={collapsed}
            />
          )}
          {visibleGroups.map((group) => (
            <NavGroupMenu
              key={group.id}
              group={group}
              pathname={pathname}
              collapsed={collapsed}
              open={query.length > 0 || openGroupId === group.id}
              onOpenChange={(next) => {
                if (query) return
                setOpenGroupId(next ? group.id : null)
              }}
            />
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-4">
        <ThemeSwitch className="px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span]:hidden" />
      </SidebarFooter>
    </Sidebar>
  )
}
