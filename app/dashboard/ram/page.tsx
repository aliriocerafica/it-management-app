import { AccessoryInventoryTable } from "@/components/accessory-inventory-table"
import { listAccessories, listLaptops } from "@/lib/inventory-repository"
import { toRamHost } from "@/lib/ram"

export const dynamic = "force-dynamic"

export default async function Page() {
  // RAM is installed in laptops, so the table needs them to pick from.
  const [items, laptops] = await Promise.all([
    listAccessories("ram"),
    listLaptops(),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        RAM Inventory
      </h1>
      <AccessoryInventoryTable
        kind="ram"
        initialData={items}
        laptops={laptops.map(toRamHost)}
      />
    </div>
  )
}
