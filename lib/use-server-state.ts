import { useState } from "react"

import { savesPending } from "@/lib/save-queue"

// State that starts from data the server rendered and can be edited
// locally, and that takes the server's copy again whenever the page is
// refreshed with a new one. Pass a stable value: a fresh array on every
// render would reset the state every time.
export function useServerState<T>(server: T) {
  const [state, setState] = useState(server)
  const [seen, setSeen] = useState(server)
  if (seen !== server) {
    setSeen(server)
    // A copy fetched while a save was still in flight predates that save,
    // so it's dropped; the refresh that follows the save brings the next.
    if (!savesPending()) setState(server)
  }
  return [state, setState] as const
}
