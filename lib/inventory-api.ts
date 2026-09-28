import type { Accessory } from "@/lib/accessories"
import type { Laptop } from "@/lib/laptops"

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error((await response.text()) || response.statusText)
  }
  return response.json() as Promise<T>
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
