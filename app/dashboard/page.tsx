import { DashboardOverview } from "@/components/dashboard-overview"
import { requireSession } from "@/lib/auth/session"
import { accessoryConfigs, type AccessoryKind } from "@/lib/accessories"
import { listAccessories, listLaptops } from "@/lib/inventory-repository"
import { listUsers } from "@/lib/user-repository"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const accessoryKinds = Object.keys(accessoryConfigs) as AccessoryKind[]

  const [user, laptops, accessoryLists, users] = await Promise.all([
    requireSession(),
    listLaptops(),
    Promise.all(accessoryKinds.map((kind) => listAccessories(kind))),
    listUsers(),
  ])

  return (
    <DashboardOverview
      user={user}
      laptops={laptops}
      accessories={accessoryLists.flat()}
      users={users}
    />
  )
}
