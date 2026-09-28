import { LaptopInventoryTable } from "@/components/laptop-inventory-table"
import { listLaptops } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function LaptopInventoryPage() {
  const laptops = await listLaptops()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Laptop Inventory
      </h1>
      <LaptopInventoryTable initialData={laptops} />
    </div>
  )
}
