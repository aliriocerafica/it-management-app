"use client"

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BackpackIcon,
  BatteryIcon,
  KeyboardIcon,
  BoxesIcon,
  ChartColumnIcon,
  ChartPieIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ClipboardListIcon,
  FileTextIcon,
  HeadphonesIcon,
  LaptopIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LockIcon,
  LockOpenIcon,
  LogOutIcon,
  MemoryStickIcon,
  MouseIcon,
  PaletteIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  TvMinimalIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import { AnyDeskIcon } from "@/components/anydesk-icon"
import { MascotStill, SidebarMascot } from "@/components/sidebar-mascot"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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

const topLevelItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Laptop Analytics",
    href: "/dashboard/analytics",
    icon: ChartColumnIcon,
  },
  {
    title: "Ticket Analytics",
    href: "/dashboard/ticket-analytics",
    icon: ChartPieIcon,
  },
]

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
      {
        title: "Chargers",
        href: "/dashboard/chargers",
        icon: PlugIcon,
        vacantKey: "charger",
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
      {
        title: "IT Troubleshooting Tickets",
        href: "/dashboard/tickets",
        icon: WrenchIcon,
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

const LOCKED_GROUPS_KEY = "sidebar-locked-groups"

// The locked group ids as JSON. Held here as well as in localStorage, so a
// lock still works for the session when storage is blocked.
let lockedGroupsJson: string | null = null
const lockedGroupsListeners = new Set<() => void>()

function subscribeLockedGroups(listener: () => void) {
  lockedGroupsListeners.add(listener)
  return () => {
    lockedGroupsListeners.delete(listener)
  }
}

function readLockedGroups() {
  if (lockedGroupsJson === null) {
    try {
      lockedGroupsJson = localStorage.getItem(LOCKED_GROUPS_KEY) ?? "[]"
    } catch {
      // Private window, blocked storage, etc. — just start unlocked.
      lockedGroupsJson = "[]"
    }
  }
  return lockedGroupsJson
}

function writeLockedGroups(ids: string[]) {
  lockedGroupsJson = JSON.stringify(ids)
  try {
    localStorage.setItem(LOCKED_GROUPS_KEY, lockedGroupsJson)
  } catch {
    // Ignore — the lock still works for this session.
  }
  for (const listener of lockedGroupsListeners) listener()
}

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

const labelMotion =
  "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,flex-grow] duration-300 ease-sidebar motion-reduce:duration-0 max-w-48 flex-1 opacity-100 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:opacity-0"

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
        floating
          ? "absolute top-0.5 right-1 h-4 min-w-4 px-0.5 text-[9px]"
          : "max-w-12 shrink-0 overflow-hidden transition-[max-width,opacity,margin] duration-300 ease-sidebar motion-reduce:duration-0 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0",
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
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
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
          "flex items-center gap-3 rounded-lg text-sm font-medium transition-[padding,gap,color,background-color] duration-300 ease-sidebar motion-reduce:duration-0",
          nested ? "h-9 px-2.5" : "h-10 rounded-xl px-3",
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
        <span className={labelMotion}>{item.title}</span>
        <NavCount item={item} floating={collapsed} />
        {item.action && (
          <button
            type="button"
            className={cn(
              "flex size-5 max-w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground transition-[max-width,opacity,margin] duration-300 ease-sidebar motion-reduce:duration-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 hover:bg-accent hover:text-foreground",
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
  locked,
  onLockChange,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  locked: boolean
  onLockChange: (locked: boolean) => void
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
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(`${item.href}/`))
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
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={`nav-group-${group.id}`}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          onOpenChange(!open)
        }}
        className={cn(
          "flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium outline-none transition-[padding,gap,color,background-color] duration-300 ease-sidebar motion-reduce:duration-0 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          open || childActive
            ? "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <group.icon className="size-4 shrink-0" />
        <span className={labelMotion}>{group.title}</span>
        <span className="flex shrink-0 items-center gap-1 overflow-hidden transition-[max-width,opacity] duration-300 ease-sidebar motion-reduce:duration-0 max-w-24 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
        {!open && total && (
          <span aria-label={totalLabel} className={countBadgeClass}>
            {total}
          </span>
        )}
        <button
          type="button"
          aria-pressed={locked}
          aria-label={locked ? `Unlock ${group.title}` : `Keep ${group.title} open`}
          title={locked ? "Unlock — it can collapse again" : "Keep this group open"}
          onClick={(event) => {
            event.stopPropagation()
            onLockChange(!locked)
          }}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            locked
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-muted-foreground",
          )}
        >
          {locked ? (
            <LockIcon className="size-3.5" />
          ) : (
            <LockOpenIcon className="size-3.5" />
          )}
        </button>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-sidebar motion-reduce:duration-0",
            open && "rotate-180 text-foreground",
          )}
        />
        </span>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-sidebar motion-reduce:duration-0",
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

const SIDEBAR_MOTION_MS = 300

function useSettledCollapse(collapsed: boolean) {
  const [settled, setSettled] = useState(collapsed)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || !collapsed) {
      setSettled(collapsed)
      return
    }
    const id = window.setTimeout(() => setSettled(true), SIDEBAR_MOTION_MS)
    return () => window.clearTimeout(id)
  }, [collapsed])

  return settled
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
  const iconLayout = useSettledCollapse(collapsed)
  const initial = user.name.trim()[0]?.toUpperCase() ?? "?"
  const [search, setSearch] = useState("")
  const activeGroupId =
    navGroups.find((group) =>
      group.items.some((item) => item.href === pathname),
    )?.id ?? null
  const [openGroupId, setOpenGroupId] = useState<string | null>(activeGroupId)
  // Groups pinned open regardless of navigation. Remembered per browser;
  // the server render starts with none so it matches the first client one.
  const lockedGroupsJson = useSyncExternalStore(
    subscribeLockedGroups,
    readLockedGroups,
    () => "[]",
  )
  const lockedGroupIds = useMemo(() => {
    try {
      return new Set(JSON.parse(lockedGroupsJson) as string[])
    } catch {
      return new Set<string>()
    }
  }, [lockedGroupsJson])
  const [vacantCounts, setVacantCounts] = useState(initialVacantCounts)
  const [pendingRequestCount, setPendingRequestCount] = useState(
    initialPendingRequestCount,
  )

  function setGroupLocked(groupId: string, locked: boolean) {
    const next = new Set(lockedGroupIds)
    if (locked) next.add(groupId)
    else next.delete(groupId)
    writeLockedGroups([...next])
  }

  // Fresh counts from the server replace whatever was fetched since.
  const [seenVacantCounts, setSeenVacantCounts] = useState(initialVacantCounts)
  if (seenVacantCounts !== initialVacantCounts) {
    setSeenVacantCounts(initialVacantCounts)
    setVacantCounts(initialVacantCounts)
  }
  const [seenPendingCount, setSeenPendingCount] = useState(
    initialPendingRequestCount,
  )
  if (seenPendingCount !== initialPendingRequestCount) {
    setSeenPendingCount(initialPendingRequestCount)
    setPendingRequestCount(initialPendingRequestCount)
  }

  // Navigating into a group opens it.
  const [seenActiveGroupId, setSeenActiveGroupId] = useState(activeGroupId)
  if (seenActiveGroupId !== activeGroupId) {
    setSeenActiveGroupId(activeGroupId)
    if (activeGroupId) setOpenGroupId(activeGroupId)
  }

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

  const visibleTopLevelItems = topLevelItems.filter(
    (item) => !query || item.title.toLowerCase().includes(query),
  )

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
            collapsed && "rotate-180",
          )}
        />
      </button>

      <SidebarHeader className="gap-4 overflow-x-clip p-4 transition-[gap,padding] duration-300 ease-sidebar motion-reduce:duration-0 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-3">
        <DropdownMenu>
          <div
            className={cn(
              "flex items-center gap-2",
              iconLayout && "justify-center",
            )}
          >
            {/* The mascot is a button of its own (click to boop it), so it
                sits beside the menu trigger rather than inside it. */}
            {!iconLayout && <SidebarMascot user={user} />}
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 text-left outline-none hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              {/* Collapsed, there's no room for both: a still of the mascot
                  opens the menu. */}
              {iconLayout && (
                <MascotStill
                  user={user}
                  className="size-8 transition-[width,height] duration-300 ease-sidebar motion-reduce:duration-0"
                />
              )}
              <div className={cn(labelMotion, "leading-tight")}>
                <span className="truncate text-base font-semibold text-sidebar-foreground">
                  {user.name}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  IT Management
                </span>
              </div>
            </DropdownMenuTrigger>
          </div>
          <DropdownMenuContent
            className="min-w-64 rounded-2xl p-2"
            side="bottom"
            align="start"
            sideOffset={8}
          >
            <div className="flex items-center gap-3 rounded-xl border border-border p-2.5">
              <Avatar className="avatar-shine size-10 shrink-0 after:rounded-full">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                )}
                <AvatarFallback className="bg-neutral-900 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-semibold">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
            <DropdownMenuGroup className="mt-2 flex flex-col gap-0.5">
              <DropdownMenuItem
                className="h-10 rounded-lg px-2.5"
                onClick={() => router.push("/dashboard/settings/profile")}
              >
                <UserIcon />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-10 rounded-lg px-2.5"
                onClick={() => router.push("/dashboard/settings")}
              >
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                className="h-10 rounded-lg px-2.5"
                onClick={handleLogout}
              >
                <LogOutIcon />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-sidebar motion-reduce:duration-0",
            collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
          )}
        >
          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="relative min-h-0 overflow-hidden"
          >
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search pages"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              aria-label="Search pages"
              tabIndex={collapsed ? -1 : undefined}
              className="h-10 rounded-xl border-0 bg-muted/70 pl-9 shadow-none focus-visible:ring-2 dark:bg-muted/40"
            />
          </form>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3">
        <nav className="flex flex-col gap-1 px-1 pb-3">
          {visibleTopLevelItems.length === 0 && visibleGroups.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No results for &ldquo;{search}&rdquo;
            </p>
          )}
          {visibleTopLevelItems.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={iconLayout}
            />
          ))}
          {visibleGroups.map((group) => (
            <NavGroupMenu
              key={group.id}
              group={group}
              pathname={pathname}
              collapsed={iconLayout}
              open={
                !collapsed &&
                (query.length > 0 ||
                  openGroupId === group.id ||
                  lockedGroupIds.has(group.id))
              }
              onOpenChange={(next) => {
                if (query) return
                setOpenGroupId(next ? group.id : null)
              }}
              locked={lockedGroupIds.has(group.id)}
              onLockChange={(locked) => setGroupLocked(group.id, locked)}
            />
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-4">
        <Link
          href="/dashboard/settings#appearance"
          title={collapsed ? "Themes" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-300 ease-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            pathname.startsWith("/dashboard/settings") &&
              "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white",
          )}
        >
          <PaletteIcon className="size-4 shrink-0" />
          <span className={labelMotion}>Themes</span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
