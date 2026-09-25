import { AccessoryInventoryTable } from "@/components/accessory-inventory-table"

export default function Page() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Monitor Inventory
      </h1>
      <AccessoryInventoryTable kind="monitor" />
    </div>
  )
}
