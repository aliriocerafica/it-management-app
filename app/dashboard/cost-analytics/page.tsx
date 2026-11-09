import { CostAnalyticsDashboard } from "@/components/cost-analytics-dashboard"
import { listAllAccessories, listLaptops } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function CostAnalyticsPage() {
  const [laptops, accessories] = await Promise.all([
    listLaptops(),
    listAllAccessories(),
  ])
  return <CostAnalyticsDashboard laptops={laptops} accessories={accessories} />
}
