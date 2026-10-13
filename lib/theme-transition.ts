import { useSyncExternalStore } from "react"

import { themeAppearance, type ThemeChoice } from "@/lib/themes"

const DURATION_MS = 2000

const storageKey = "theme-transition"
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
function themeTransitionEnabled() {
  try {
    return window.localStorage.getItem(storageKey) !== "off"
  } catch {
    return true
  }
}

export function setThemeTransitionEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(storageKey, enabled ? "on" : "off")
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
  for (const listener of listeners) listener()
}

export function useThemeTransitionEnabled() {
  return useSyncExternalStore(subscribe, themeTransitionEnabled, () => true)
}

export type { ThemeChoice }

function systemResolved(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function resolvedThemeChoice(
  choice: ThemeChoice,
): Exclude<ThemeChoice, "system"> {
  return choice === "system" ? systemResolved() : choice
}

export function applyThemeChoice(
  choice: ThemeChoice,
  currentResolved: string | undefined,
  setTheme: (theme: string) => void,
) {
  const nextResolved = resolvedThemeChoice(choice)
  if (nextResolved === currentResolved) {
    setTheme(choice)
    return
  }
  const to = themeAppearance(nextResolved)
  if (to === themeAppearance(currentResolved)) {
    setTheme(choice)
    return
  }
  playThemeTransition(to, () => setTheme(choice))
}

// Plays the sky animation (styled in globals.css as `.theme-shift`) over the
// whole page: the sun sets and the moon rises going dark, the reverse going
// light. `apply` switches the theme halfway through, while the sky covers the
// page, so the new theme is what's revealed when it fades out.
export function playThemeTransition(to: "light" | "dark", apply: () => void) {
  if (
    !themeTransitionEnabled() ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.querySelector(".theme-shift")
  ) {
    apply()
    return
  }

  const overlay = document.createElement("div")
  overlay.className = "theme-shift"
  overlay.dataset.to = to
  overlay.setAttribute("aria-hidden", "true")
  const rising = Array.from({ length: 28 }, () => {
    const left = (Math.random() * 100).toFixed(1)
    const bottom = (Math.random() * 70).toFixed(1)
    const delay = (0.4 + Math.random() * 0.9).toFixed(2)
    const size = Math.random() < 0.2 ? 3 : 2
    return (
      `<div class="theme-shift-star-up" style="left:${left}%;bottom:${bottom}%;` +
      `width:${size}px;height:${size}px;animation-delay:${delay}s"></div>`
    )
  }).join("")

  overlay.innerHTML =
    '<div class="theme-shift-night"></div>' +
    '<div class="theme-shift-day"></div>' +
    '<div class="theme-shift-star"></div>'.repeat(3) +
    rising +
    '<div class="theme-shift-cloud" style="top:20%;left:10%"></div>' +
    '<div class="theme-shift-cloud" style="top:32%;left:70%;scale:0.8;--drift:-7vw"></div>' +
    '<div class="theme-shift-cloud" style="top:10%;left:52%;scale:0.55"></div>' +
    '<div class="theme-shift-satellite"></div>' +
    '<div class="theme-shift-body theme-shift-sun"></div>' +
    '<div class="theme-shift-body theme-shift-moon"></div>'
  document.body.append(overlay)

  window.setTimeout(apply, DURATION_MS / 2)
  window.setTimeout(() => overlay.remove(), DURATION_MS)
}
