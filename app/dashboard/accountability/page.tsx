import { AccountabilityTable } from "@/components/accountability-table"
import { listAccountabilityRows } from "@/lib/accountability-repository"

export const dynamic = "force-dynamic"

export default async function AccountabilityPage() {
  const rows = await listAccountabilityRows()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Accountability
      </h1>
      <AccountabilityTable initialData={rows} />
    </div>
  )
}
