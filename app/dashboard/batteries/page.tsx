import { AccessoryInventoryTable } from "@/components/accessory-inventory-table"
import { listAccessories } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function Page() {
  const items = await listAccessories("battery")

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Battery Inventory
      </h1>
      <AccessoryInventoryTable kind="battery" initialData={items} />
    </div>
  )
}
