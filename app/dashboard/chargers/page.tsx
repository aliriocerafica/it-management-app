import { AccessoryInventoryTable } from "@/components/accessory-inventory-table"
import { listOpenLocalAssetRequests } from "@/lib/asset-request-repository"
import { listAccessories, listLaptops } from "@/lib/inventory-repository"
import { toRamHost } from "@/lib/ram"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [items, laptops, openRequests] = await Promise.all([
    listAccessories("charger"),
    listLaptops(),
    listOpenLocalAssetRequests(),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Charger Inventory
      </h1>
      <AccessoryInventoryTable
        kind="charger"
        initialData={items}
        laptops={laptops.map(toRamHost)}
        openRequests={openRequests}
      />
    </div>
  )
}
