import type { Accessory } from "@/lib/accessories"
import type { Laptop } from "@/lib/laptops"

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
  return parse<Laptop>(
    await fetch(`/api/laptops/${laptop.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(laptop),
    }),
  )
}

export async function createLaptop(laptop: Laptop) {
  return parse<Laptop>(
    await fetch("/api/laptops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(laptop),
    }),
  )
}

export async function removeLaptops(ids: string[]) {
  return parse<{ ok: boolean }>(
    await fetch("/api/laptops", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  )
}

export async function saveAccessory(item: Accessory) {
  return parse<Accessory>(
    await fetch(`/api/accessories/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }),
  )
}

export async function createAccessory(item: Accessory) {
  return parse<Accessory>(
    await fetch("/api/accessories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }),
  )
}

export async function removeAccessories(ids: string[]) {
  return parse<{ ok: boolean }>(
    await fetch("/api/accessories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  )
}

export async function listAssignedAssets(handler: string) {
  return parse<{ laptops: Laptop[]; accessories: Accessory[] }>(
    await fetch(`/api/assigned-assets?handler=${encodeURIComponent(handler)}`),
  )
}
