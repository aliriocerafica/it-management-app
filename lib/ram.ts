// RAM modules are installed in laptops instead of being handed to people.
// These keep a laptop's "Memory" text in step with the modules put in or
// taken out of it. Shared by the server (which saves both together) and the
// RAM table (which shows the new totals right away).

import type { Accessory } from "@/lib/accessories"
import type { Laptop } from "@/lib/laptops"

// What the RAM table needs to know about a laptop it can install into.
export type RamHost = Pick<
  Laptop,
  "id" | "assetTag" | "brand" | "model" | "ram" | "handler" | "status"
>

export function toRamHost(laptop: Laptop): RamHost {
  const { id, assetTag, brand, model, ram, handler, status } = laptop
  return { id, assetTag, brand, model, ram, handler, status }
}

// Size in GB from text such as "8 GB" or "16GB"; null when there isn't one
// (for example "To be confirmed").
export function parseGb(text: string | null | undefined): number | null {
  const match = text?.match(/(\d+(?:\.\d+)?)\s*GB/i)
  return match ? Number(match[1]) : null
}

// A laptop's memory with `deltaGb` added (or removed, when negative).
// Memory that isn't a known size stays as is: there's no total to add to.
export function adjustRam(ram: string, deltaGb: number): string {
  const current = parseGb(ram)
  if (current === null || deltaGb === 0) return ram
  return `${Math.max(0, current + deltaGb)} GB`
}

type Installable = Pick<Accessory, "kind" | "status" | "laptopId" | "specs">

// A module counts toward its laptop's memory only while it's in use there.
// Anything else (back in stock, in repair, retired) has been taken out.
export function withInstallState<T extends Installable>(item: T): T {
  if (item.kind !== "ram" || item.status !== "In use") {
    return item.laptopId ? { ...item, laptopId: null } : item
  }
  return item
}

// The laptop a module adds memory to, and how much.
export function ramLoad(
  item: Installable | null | undefined,
): { laptopId: string; gb: number } | null {
  if (!item) return null
  const { laptopId, kind, status, specs } = withInstallState(item)
  const gb = parseGb(specs.capacity)
  if (kind !== "ram" || status !== "In use" || !laptopId || !gb) return null
  return { laptopId, gb }
}

// The memory changes, per laptop, of a module going from `before` to
// `after` (either may be null for a module being created or deleted).
export function ramChanges(
  before: Installable | null | undefined,
  after: Installable | null | undefined,
): Map<string, number> {
  const changes = new Map<string, number>()
  const from = ramLoad(before)
  const to = ramLoad(after)
  if (from) changes.set(from.laptopId, -from.gb)
  if (to) changes.set(to.laptopId, (changes.get(to.laptopId) ?? 0) + to.gb)
  for (const [id, gb] of changes) if (gb === 0) changes.delete(id)
  return changes
}
