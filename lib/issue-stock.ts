import {
  accessoryConfigs,
  lowerNoun,
  type Accessory,
  type AccessoryKind,
} from "@/lib/accessories"
import { assignIssuedItem, todayIsoDate } from "@/lib/inventory-lifecycle"
import type { Laptop } from "@/lib/laptops"
import { installRamInLaptop, type RamHost } from "@/lib/ram"

export type IssueStockKind = AccessoryKind | "laptop"

export type IssuedInventory =
  | { kind: "laptop"; item: Laptop }
  | { kind: "ram"; item: Accessory; host: RamHost | null }
  | { kind: Exclude<AccessoryKind, "ram">; item: Accessory }

const exactKinds: Record<string, IssueStockKind> = {
  laptop: "laptop",
  "laptop set": "laptop",
  headset: "headset",
  headphones: "headset",
  headphone: "headset",
  mouse: "mouse",
  keyboard: "keyboard",
  monitor: "monitor",
  "laptop bag": "bag",
  bag: "bag",
  battery: "battery",
  ram: "ram",
  "ram module": "ram",
  "ram modules": "ram",
  memory: "ram",
}

// Request labels from this app and from DTR ("Headset", "RAM", "Laptop bag"…).
export function inventoryKindForAssetType(assetType: string): IssueStockKind | null {
  const key = assetType.trim().toLowerCase().replace(/\s+/g, " ")
  if (!key) return null
  if (exactKinds[key]) return exactKinds[key]
  if (/\bram\b/.test(key) || /\bmemory\b/.test(key)) return "ram"
  if (key.includes("headset") || key.includes("headphone")) return "headset"
  if (key.includes("keyboard")) return "keyboard"
  if (/\bmouse\b/.test(key) || key.includes("mice")) return "mouse"
  if (key.includes("monitor") || key.includes("display")) return "monitor"
  if (key.includes("bag")) return "bag"
  if (key.includes("battery") || key.includes("batteries")) return "battery"
  if (key.includes("laptop")) return "laptop"
  return null
}

export function stockNoun(kind: IssueStockKind, count = 2) {
  if (kind === "laptop") return count === 1 ? "laptop" : "laptops"
  const config = accessoryConfigs[kind]
  const name = count === 1 ? config.singular : config.plural
  return lowerNoun(name)
}

const unusableSerial = /^(pending|n\/a|na|none|tbd|unknown)\b/i

export function usableSerial(serial: string) {
  const value = serial.trim()
  return value.length >= 3 && !unusableSerial.test(value)
}

export type IssuedHolding = {
  id: string
  kind: IssueStockKind
  assetTag: string
  brand: string
  model: string
  serialNumber: string
  holder: string
  // Set for RAM installed in a laptop.
  installedIn: string | null
}

// In-use inventory of the requested type that this person already has.
// `completed` is the unit whose serial is named on a finished request.
export function requestHoldings(
  holdings: IssuedHolding[],
  request: {
    requesterName: string
    assetType: string
    resolutionNote?: string | null
  },
) {
  const kind = inventoryKindForAssetType(request.assetType)
  if (!kind) return null
  const items = holdings.filter(
    (item) => item.kind === kind && samePerson(item.holder, request.requesterName),
  )
  const note = request.resolutionNote?.toLowerCase() ?? ""
  const completed =
    items.find((item) => {
      const serial = item.serialNumber.trim().toLowerCase()
      return serial.length >= 3 && note.includes(serial)
    }) ?? null
  return { kind, items, completed }
}

export function holdingFromIssued(
  stock: IssuedInventory,
  holder: string,
): IssuedHolding {
  const { item } = stock
  return {
    id: item.id,
    kind: stock.kind,
    assetTag: item.assetTag,
    brand: item.brand,
    model: item.model,
    serialNumber: item.serialNumber,
    holder,
    installedIn: stock.kind === "ram" && stock.host ? stock.host.assetTag : null,
  }
}

export function samePerson(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const left = a?.trim().toLowerCase().replace(/\s+/g, " ") ?? ""
  const right = b?.trim().toLowerCase().replace(/\s+/g, " ") ?? ""
  return left.length > 0 && left === right
}

const hintStopWords = new Set([
  "for",
  "the",
  "and",
  "with",
  "from",
  "this",
  "that",
  "need",
  "needs",
  "please",
  "request",
  "requested",
])

// How well an inventory row matches the request text (reason, model, size…).
export function stockHintScore(
  item: {
    brand: string
    model: string
    assetTag: string
    serialNumber: string
    specs?: Record<string, string>
  },
  hint: string,
) {
  const tokens = hint
    .toLowerCase()
    .split(/[^a-z0-9.+]+/)
    .filter((token) => token.length >= 2 && !hintStopWords.has(token))
  if (tokens.length === 0) return 0
  const haystack = [
    item.brand,
    item.model,
    item.assetTag,
    item.serialNumber,
    ...Object.values(item.specs ?? {}),
  ]
    .join(" ")
    .toLowerCase()
  return tokens.reduce(
    (score, token) => (haystack.includes(token) ? score + 1 : score),
    0,
  )
}

// The row to pre-select: the only vacant unit, or the single best text match.
export function detectStockItem<T extends { id: string }>(
  items: T[],
  score: (item: T) => number,
): T | null {
  if (items.length === 1) return items[0]
  let best: T | null = null
  let bestScore = 0
  let tied = false
  for (const item of items) {
    const value = score(item)
    if (value > bestScore) {
      best = item
      bestScore = value
      tied = false
    } else if (value === bestScore && value > 0) {
      tied = true
    }
  }
  return best && bestScore > 0 && !tied ? best : null
}

export function issuedItemUpdate(
  stock: IssuedInventory,
  holder: { name: string; department: string | null },
  note: string,
): { kind: "laptop"; item: Laptop } | { kind: "accessory"; item: Accessory } {
  if (stock.kind === "laptop") {
    return { kind: "laptop", item: assignIssuedItem(stock.item, holder, note) }
  }
  if (stock.kind === "ram" && stock.host) {
    return {
      kind: "accessory",
      item: installRamInLaptop(stock.item, stock.host, note, todayIsoDate()),
    }
  }
  return { kind: "accessory", item: assignIssuedItem(stock.item, holder, note) }
}
