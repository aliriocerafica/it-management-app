// Chargers are installed in laptops instead of being handed to people.
// The laptop's charger snapshot stays in step with the unit assigned to it.

import type { Accessory } from "@/lib/accessories"
import type { Charger, ChargerCondition, Laptop } from "@/lib/laptops"
import {
  installRamInLaptop,
  removeRamFromLaptop,
  type RamHost,
} from "@/lib/ram"

export type ChargerHost = RamHost & Pick<Laptop, "charger">

export const chargerConnectors = [
  "USB-C",
  "MagSafe 3 (USB-C)",
  "Surface Connect",
  "Barrel 4.5 mm",
  "Barrel 7.4 mm",
]

export const chargerConditions: ChargerCondition[] = [
  "Good",
  "Worn cable",
  "Replaced",
  "Missing",
]

const stockConditions: ChargerCondition[] = [
  "Good",
  "Worn cable",
  "Replaced",
]

export function toChargerHost(laptop: Laptop): ChargerHost {
  const { id, assetTag, brand, model, ram, handler, status, charger } = laptop
  return { id, assetTag, brand, model, ram, handler, status, charger }
}

export function parseWattage(text: string | null | undefined): number {
  const match = text?.match(/(\d+(?:\.\d+)?)/)
  const n = match ? Number(match[1]) : NaN
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 65
}

export function chargerFromAccessory(item: Accessory): Charger {
  const raw = item.specs.condition as ChargerCondition | undefined
  return {
    connector: item.specs.connector || "USB-C",
    wattage: parseWattage(item.specs.wattage),
    partNumber: item.specs.partNumber || "",
    serialNumber: item.serialNumber,
    condition: stockConditions.includes(raw as ChargerCondition)
      ? (raw as ChargerCondition)
      : "Good",
  }
}

export function chargerToSpecs(charger: Charger): Record<string, string> {
  return {
    connector: charger.connector,
    wattage: String(charger.wattage),
    partNumber: charger.partNumber,
    condition: charger.condition === "Missing" ? "Good" : charger.condition,
  }
}

export function missingCharger(previous: Charger): Charger {
  return {
    connector: previous.connector,
    wattage: previous.wattage,
    partNumber: "",
    serialNumber: "",
    condition: "Missing",
  }
}

export function chargerInLaptop(items: Accessory[], laptopId: string) {
  return items.find(
    (item) =>
      item.kind === "charger" &&
      item.status === "In use" &&
      item.laptopId === laptopId,
  )
}

export function vacantChargers(items: Accessory[]) {
  return items.filter(
    (item) => item.kind === "charger" && item.status === "Vacant",
  )
}

export function chargerLabel(item: Accessory) {
  const watts = item.specs.wattage ? `${item.specs.wattage} W` : ""
  return [item.assetTag, item.specs.connector, watts]
    .filter(Boolean)
    .join(" · ")
}

export function installChargerInLaptop(
  item: Accessory,
  host: RamHost,
  note: string,
  todayIso: string,
) {
  return installRamInLaptop(item, host, note, todayIso)
}

export function removeChargerFromLaptop(
  item: Accessory,
  host: RamHost | undefined,
  todayIso: string,
) {
  return removeRamFromLaptop(item, host, todayIso)
}
