import { AssetRequestTable } from "@/components/asset-request-table"
import {
  applyRequestOverrides,
  listAssetRequests,
  listRequestOverrides,
} from "@/lib/asset-request-repository"
import { listDtrAssetRequests } from "@/lib/dtr"
import { withRequesterEmails } from "@/lib/hris"

export const dynamic = "force-dynamic"

export default async function AssetRequestsPage() {
  const [local, overrides] = await Promise.all([
    listAssetRequests(),
    listRequestOverrides(),
  ])
  let dtrError: string | null = null
  let fromDtr: Awaited<ReturnType<typeof listDtrAssetRequests>> = []
  try {
    fromDtr = await listDtrAssetRequests()
  } catch (error) {
    console.error("Failed to load DTR asset requests", error)
    dtrError =
      error instanceof Error
        ? error.message
        : "Couldn't load asset requests from DTR."
  }
  const requests = await withRequesterEmails(
    applyRequestOverrides([...local, ...fromDtr], overrides).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        IT Asset Requests
      </h1>
      {dtrError && (
        <p className="text-sm text-red-600 dark:text-red-400">{dtrError}</p>
      )}
      <AssetRequestTable initialData={requests} />
    </div>
  )
}
