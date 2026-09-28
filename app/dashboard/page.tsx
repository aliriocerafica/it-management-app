import { DashboardOverview } from "@/components/dashboard-overview"
import { requireSession } from "@/lib/auth/session"
import { accessoryConfigs, type AccessoryKind } from "@/lib/accessories"
import {
  getInventorySummary,
  listAccessories,
  listLaptops,
} from "@/lib/inventory-repository"
import { listUsers } from "@/lib/user-repository"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const accessoryKinds = Object.keys(accessoryConfigs) as AccessoryKind[]

  const [user, summary, laptops, accessoryLists, users] = await Promise.all([
    requireSession(),
    getInventorySummary(),
    listLaptops(),
    Promise.all(accessoryKinds.map((kind) => listAccessories(kind))),
    listUsers(),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Dashboard
      </h1>
      <DashboardOverview
        user={user}
        summary={summary}
        laptops={laptops}
        accessories={accessoryLists.flat()}
        users={users}
      />
    </div>
  )
}
