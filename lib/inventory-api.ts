import type { AssetRequest, RequestStatus } from "@/lib/asset-requests"
import type { Accessory } from "@/lib/accessories"
import type { Laptop } from "@/lib/laptops"
import { queued } from "@/lib/save-queue"

export const INVENTORY_CHANGED = "inventory-changed"

function notifyInventoryChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(INVENTORY_CHANGED))
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Couldn't save to the database (error ${response.status}).`
    try {
      message = ((await response.json()) as { error?: string }).error ?? message
    } catch {
      // Not JSON (e.g. a platform error page); keep the generic message.
    }
    if (response.status === 401) {
      message = "Your session has expired. Sign in again to save changes."
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Couldn't save to the database. Please try again."
}

export async function saveLaptop(laptop: Laptop) {
  return queued([laptop.id], async () => {
    const saved = await parse<Laptop>(
      await fetch(`/api/laptops/${laptop.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(laptop),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function createLaptop(laptop: Laptop) {
  return queued([laptop.id], async () => {
    const saved = await parse<Laptop>(
      await fetch("/api/laptops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(laptop),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function removeLaptops(ids: string[]) {
  return queued(ids, async () => {
    const result = await parse<{ ok: boolean }>(
      await fetch("/api/laptops", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    )
    notifyInventoryChanged()
    return result
  })
}

export async function saveAccessory(item: Accessory) {
  return queued([item.id], async () => {
    const saved = await parse<Accessory>(
      await fetch(`/api/accessories/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function createAccessory(item: Accessory) {
  return queued([item.id], async () => {
    const saved = await parse<Accessory>(
      await fetch("/api/accessories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function removeAccessories(ids: string[]) {
  return queued(ids, async () => {
    const result = await parse<{ ok: boolean }>(
      await fetch("/api/accessories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    )
    notifyInventoryChanged()
    return result
  })
}

export async function fetchLaptops() {
  return parse<Laptop[]>(await fetch("/api/laptops"))
}

export async function listAssignedAssets(handler: string) {
  return parse<{ laptops: Laptop[]; accessories: Accessory[] }>(
    await fetch(`/api/assigned-assets?handler=${encodeURIComponent(handler)}`),
  )
}

export async function createAssetRequest(request: AssetRequest) {
  return queued([request.id], async () => {
    const saved = await parse<AssetRequest>(
      await fetch("/api/asset-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function saveAssetRequest(request: AssetRequest) {
  return queued([request.id], async () => {
    const saved = await parse<AssetRequest>(
      await fetch(`/api/asset-requests/${request.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function approveDtrAsset(id: string, note?: string) {
  return queued([id], async () => {
    const saved = await parse<AssetRequest>(
      await fetch(`/api/asset-requests/dtr/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function rejectDtrAsset(id: string, note: string) {
  return queued([id], async () => {
    const saved = await parse<AssetRequest>(
      await fetch(`/api/asset-requests/dtr/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function saveExternalRequestOverride(
  id: string,
  status: RequestStatus,
  note?: string | null,
) {
  return queued([id], async () => {
    const saved = await parse<{ ok: boolean }>(
      await fetch("/api/asset-requests/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, note }),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function archiveExternalAssetRequest(id: string) {
  return saveExternalRequestOverride(id, "Archived")
}

export async function unarchiveExternalAssetRequest(id: string) {
  return queued([id], async () => {
    const saved = await parse<{ ok: boolean }>(
      await fetch("/api/asset-requests/archive", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function issueDtrAsset(id: string, input: {
  serialNumber: string
  conditionIssued: "NEW" | "GOOD" | "FAIR" | "POOR"
}) {
  return queued([id], async () => {
    const saved = await parse<AssetRequest>(
      await fetch(`/api/asset-requests/dtr/${encodeURIComponent(id)}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function returnDtrAsset(id: string, returnCondition: "NEW" | "GOOD" | "FAIR" | "POOR" | "DAMAGED") {
  return queued([id], async () => {
    const saved = await parse<AssetRequest>(
      await fetch(`/api/asset-requests/dtr/${encodeURIComponent(id)}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnCondition }),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}

export async function removeAssetRequests(ids: string[]) {
  return queued(ids, async () => {
    const saved = await parse<{ ok: boolean }>(
      await fetch("/api/asset-requests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    )
    notifyInventoryChanged()
    return saved
  })
}
