import { AssetRequestTable } from "@/components/asset-request-table"
import { listAssetRequests } from "@/lib/asset-request-repository"

export const dynamic = "force-dynamic"

export default async function AssetRequestsPage() {
  const requests = await listAssetRequests()

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        IT Asset Requests
      </h1>
      <AssetRequestTable initialData={requests} />
    </div>
  )
}
