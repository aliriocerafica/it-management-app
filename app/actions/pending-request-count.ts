"use server"

import { countPendingAssetRequests } from "@/lib/asset-request-repository"
import { verifySession } from "@/lib/auth/session"

export async function fetchPendingRequestCount() {
  const user = await verifySession()
  if (!user) return 0
  return countPendingAssetRequests(true)
}
