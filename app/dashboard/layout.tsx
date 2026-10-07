import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requireSession } from "@/lib/auth/session"
import { getVacantCounts } from "@/lib/inventory-repository"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, vacantCounts] = await Promise.all([
    requireSession(),
    getVacantCounts(),
  ])

  return (
    <TooltipProvider>
      <SidebarProvider
        className="h-svh min-h-0 overflow-hidden"
        style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
      >
        <AppSidebar user={user} vacantCounts={vacantCounts} />
        <SidebarInset className="min-h-0 overflow-auto">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-medium">IT Management</span>
          </header>
          <div className="flex flex-1 flex-col p-4 sm:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
