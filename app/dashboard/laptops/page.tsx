import { LaptopInventoryTable } from "@/components/laptop-inventory-table"

export default function LaptopInventoryPage() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Laptop Inventory
      </h1>
      <LaptopInventoryTable />
    </div>
  )
}
