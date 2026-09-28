import { LaptopAnalyticsDashboard } from "@/components/laptop-analytics-dashboard"
import { listLaptops } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function LaptopAnalyticsPage() {
  const laptops = await listLaptops()
  return <LaptopAnalyticsDashboard laptops={laptops} />
}
