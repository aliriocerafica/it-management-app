import { AccessoryInventoryTable } from "@/components/accessory-inventory-table"
import { listOpenLocalAssetRequests } from "@/lib/asset-request-repository"
import { listAccessories } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function Page() {
  const [items, openRequests] = await Promise.all([
    listAccessories("bag"),
    listOpenLocalAssetRequests(),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Laptop Bag Inventory
      </h1>
      <AccessoryInventoryTable
        kind="bag"
        initialData={items}
        openRequests={openRequests}
      />
    </div>
  )
}
