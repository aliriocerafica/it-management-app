"use server"

import { verifySession } from "@/lib/auth/session"
import { getVacantCounts } from "@/lib/inventory-repository"
import type { VacantCounts } from "@/lib/inventory-map"

export async function fetchVacantCounts(): Promise<VacantCounts> {
  const user = await verifySession()
  if (!user) {
    return {
      laptops: 0,
      headset: 0,
      mouse: 0,
      monitor: 0,
      bag: 0,
      battery: 0,
      keyboard: 0,
      ram: 0,
    }
  }
  return getVacantCounts()
}
