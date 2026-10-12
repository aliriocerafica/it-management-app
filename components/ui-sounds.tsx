"use client"

import { useEffect } from "react"

import { playClickSound, playOpenSound } from "@/lib/ui-sounds"

const clickable =
  'button, a[href], summary, [role="button"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="tab"]'
const opened =
  '[data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="dropdown-menu-content"], [data-slot="date-range-content"]'

// Plays the interface sounds for the whole app: a tick on anything clickable
// and a pop when a dialog, sheet or menu appears. Renders nothing.
export function UiSounds() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const target = event.target.closest(clickable)
      if (!target || target.matches(":disabled, [aria-disabled='true']")) return
      playClickSound()
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches(opened) || node.querySelector(opened)) {
            playOpenSound()
            return
          }
        }
      }
    })

    document.addEventListener("click", handleClick, true)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      document.removeEventListener("click", handleClick, true)
      observer.disconnect()
    }
  }, [])

  return null
}
