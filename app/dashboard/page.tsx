import { DashboardInventory } from "@/components/dashboard-inventory"
import { getInventorySummary } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const summary = await getInventorySummary()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Dashboard
      </h1>
      <DashboardInventory summary={summary} />
    </div>
  )
}
