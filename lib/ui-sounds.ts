import { useSyncExternalStore } from "react"

const storageKey = "ui-sounds"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

// On unless this browser turned it off in Settings.
function uiSoundsEnabled() {
  try {
    return window.localStorage.getItem(storageKey) !== "off"
  } catch {
    return true
  }
}

export function setUiSoundsEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(storageKey, enabled ? "on" : "off")
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
  for (const listener of listeners) listener()
}

export function useUiSoundsEnabled() {
  return useSyncExternalStore(subscribe, uiSoundsEnabled, () => true)
}

let context: AudioContext | null = null

// The sounds are synthesised rather than loaded from files. Browsers only
// allow audio after a user gesture, so the context is made on first use.
function tone(
  type: OscillatorType,
  from: number,
  to: number,
  seconds: number,
  volume: number,
) {
  if (!uiSoundsEnabled()) return
  try {
    context ??= new AudioContext()
    if (context.state === "suspended") void context.resume()
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(to, now + seconds)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + seconds)
  } catch {
    // No audio available: stay silent.
  }
}

// A short, soft tick for pressing a button or link.
export function playClickSound() {
  tone("triangle", 1400, 900, 0.05, 0.05)
}

// A rising pop for a dialog, sheet or menu opening.
export function playOpenSound() {
  tone("sine", 420, 760, 0.14, 0.06)
}
