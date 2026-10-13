"use client"

import { useEffect, useRef, useState } from "react"

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

export function useAnimatedNumber(
  value: number,
  { duration = 900, delay = 0 }: { duration?: number; delay?: number } = {},
) {
  const target = Number.isFinite(value) ? value : 0
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    let raf = 0
    let timeout = 0
    let start: number | null = null
    let cancelled = false

    const show = (next: number) => {
      fromRef.current = next
      if (!cancelled) setDisplay(next)
    }

    const from = fromRef.current
    if (prefersReducedMotion() || duration <= 0 || from === target) {
      timeout = window.setTimeout(() => show(target), 0)
      return () => {
        cancelled = true
        window.clearTimeout(timeout)
      }
    }

    timeout = window.setTimeout(() => {
      const tick = (now: number) => {
        if (cancelled) return
        if (start === null) start = now
        const t = Math.min(1, (now - start) / duration)
        const next = from + (target - from) * easeOutCubic(t)
        fromRef.current = t >= 1 ? target : next
        setDisplay(t >= 1 ? target : next)
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delay])

  return display
}
