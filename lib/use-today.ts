"use client"

import { useSyncExternalStore } from "react"

// Ages are computed in the browser so they always reflect today's date,
// rather than the date the page was prerendered. Kept out of lib/laptops.ts
// so that server code (API routes, Server Components) can import its plain
// utility exports without pulling in a client-only React hook.
const noopSubscribe = () => () => {}

export function useToday() {
  const key = useSyncExternalStore(
    noopSubscribe,
    () => new Date().toDateString(),
    () => null,
  )
  return key ? new Date(key) : null
}
