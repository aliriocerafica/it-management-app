import { useSyncExternalStore } from "react"

// Saves that touch the same record run one after another, so an Undo issued
// while the original change is still saving can't land first and be
// overwritten. Also tracks which records have a save in flight, so tables
// can show a spinner and lock the row's actions until it lands.
const chains = new Map<string, Promise<unknown>>()
const counts = new Map<string, number>()
const listeners = new Set<() => void>()
const empty = new Set<string>()
let pending: Set<string> = empty

function emit() {
  pending = counts.size ? new Set(counts.keys()) : empty
  for (const listener of listeners) listener()
}

export function queued<T>(keys: string[], run: () => Promise<T>): Promise<T> {
  const before = Promise.all(keys.map((key) => (chains.get(key) ?? Promise.resolve()).catch(() => {})))
  const next = before.then(run)
  for (const key of keys) {
    chains.set(key, next)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  emit()
  const settle = () => {
    for (const key of keys) {
      const count = (counts.get(key) ?? 1) - 1
      if (count <= 0) counts.delete(key)
      else counts.set(key, count)
      if (chains.get(key) === next) chains.delete(key)
    }
    emit()
  }
  next.then(settle, settle)
  return next
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Ids with a save still in flight.
export function usePendingSaves(): Set<string> {
  return useSyncExternalStore(subscribe, () => pending, () => empty)
}
