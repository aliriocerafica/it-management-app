import { RemoteAccessTable } from "@/components/remote-access-table"
import { listRemoteAccessRows } from "@/lib/inventory-repository"

export const dynamic = "force-dynamic"

export default async function RemoteAccessPage() {
  const rows = await listRemoteAccessRows()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Remote Access
      </h1>
      <RemoteAccessTable rows={rows} />
    </div>
  )
}
