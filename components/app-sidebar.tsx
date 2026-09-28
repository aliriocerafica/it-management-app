"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BackpackIcon,
  ChartColumnIcon,
  ChevronLeftIcon,
  HeadphonesIcon,
  LaptopIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MouseIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TicketIcon,
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
import { cn } from "@/lib/utils"

const overviewItems: {
  title: string
  href: string
  icon: LucideIcon | ComponentType<{ className?: string }>
  badge?: string
  action?: boolean
}[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  {
    title: "Remote Access",
    href: "/dashboard/remote-access",
    icon: AnyDeskIcon,
  },
  {
    title: "Laptop Inventory",
    href: "/dashboard/laptops",
    icon: LaptopIcon,
  },
  { title: "Headsets", href: "/dashboard/headsets", icon: HeadphonesIcon },
  { title: "Mice", href: "/dashboard/mice", icon: MouseIcon },
  { title: "Monitors", href: "/dashboard/monitors", icon: TvMinimalIcon },
  {
    title: "Laptop Bags",
    href: "/dashboard/laptop-bags",
    icon: BackpackIcon,
  },
  {
    title: "Laptop Analytics",
    href: "/dashboard/analytics",
    icon: ChartColumnIcon,
  },
  {
    title: "Tickets",
    href: "/dashboard/tickets",
    icon: TicketIcon,
    badge: "4",
  },
  { title: "Users", href: "/dashboard/users", icon: UsersIcon },
  { title: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === "collapsed"

  function handleLogout() {
    router.push("/login")
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
                A
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-base font-semibold text-sidebar-foreground">
                Admin
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
                  <span className="text-sm font-medium">Admin</span>
                  <span className="text-xs text-muted-foreground">
                    admin@company.com
                  </span>
                </div>
              </DropdownMenuLabel>
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

        <div className="relative group-data-[collapsible=icon]:hidden">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search"
            className="h-10 rounded-xl border-0 bg-muted/70 pl-9 shadow-none focus-visible:ring-2 dark:bg-muted/40"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 group-data-[collapsible=icon]:px-3">
        <div className="px-2 pb-2 group-data-[collapsible=icon]:px-0">
          <p className="mb-2 text-[11px] group-data-[collapsible=icon]:hidden font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Overview
          </p>
          <nav className="flex flex-col gap-0.5">
            {overviewItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <div key={item.href} className="relative">
                  {isActive && (
                    <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-full bg-neutral-900 dark:bg-white" />
                  )}
                  <Link
                    href={item.href}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                      isActive
                        ? "bg-neutral-900/5 text-neutral-900 dark:bg-white/10 dark:text-white"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0 fill-current",
                        isActive && "text-neutral-900 dark:text-white"
                      )}
                    />
                    <span className="flex-1 truncate group-data-[collapsible=icon]:sr-only">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-semibold text-white group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-0.5 group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:size-4 group-data-[collapsible=icon]:text-[9px]">
                        {item.badge}
                      </span>
                    )}
                    {item.action && (
                      <button
                        type="button"
                        className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
                        aria-label={`Add ${item.title}`}
                        onClick={(event) => event.preventDefault()}
                      >
                        <PlusIcon className="size-3" />
                      </button>
                    )}
                  </Link>
                </div>
              )
            })}
          </nav>
        </div>
      </SidebarContent>

      <SidebarFooter className="gap-3 p-4">
        <ThemeSwitch className="px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:[&>span]:hidden" />
      </SidebarFooter>
    </Sidebar>
  )
}
