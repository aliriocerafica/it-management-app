"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A scroll area that flashes a green edge when the table first appears. */
export function Scrollable({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const shown = useRef(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const maybeFlash = () => {
      if (shown.current) return
      shown.current = true
      setFlash(true)
      window.setTimeout(() => setFlash(false), 2600)
    }

    maybeFlash()
    const observer = new ResizeObserver(maybeFlash)
    observer.observe(el)
    const child = el.firstElementChild
    if (child) observer.observe(child)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative min-h-0">
      <div
        ref={ref}
        className={cn(
          "overflow-auto scrollbar-none [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-20 rounded-[inherit] print:hidden",
          flash && "table-edge-flash",
        )}
      />
    </div>
  )
}
