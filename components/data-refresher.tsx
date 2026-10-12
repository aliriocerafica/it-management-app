"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { INVENTORY_CHANGED } from "@/lib/inventory-api"
import { savesPending } from "@/lib/save-queue"

// Long enough for a burst of saves (a bulk action, an Undo) to land as one
// refresh.
const SETTLE_MS = 400

// After any saved change, re-fetches the open page's data from the server,
// so everything on it (and the sidebar) reflects the change without a
// manual reload. Renders nothing.
export function DataRefresher() {
  const router = useRouter()

  useEffect(() => {
    let timer: number | undefined

    function schedule() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        // Wait for the last save, so the refresh includes it.
        if (savesPending()) schedule()
        else router.refresh()
      }, SETTLE_MS)
    }

    window.addEventListener(INVENTORY_CHANGED, schedule)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(INVENTORY_CHANGED, schedule)
    }
  }, [router])

  return null
}
