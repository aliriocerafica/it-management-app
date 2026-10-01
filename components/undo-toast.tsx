"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Undo2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  duration = 8000,
}: {
  message: string | null
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}) {
  const onDismissRef = useRef(onDismiss)
  useLayoutEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => onDismissRef.current(), duration)
    return () => window.clearTimeout(timeout)
  }, [message, duration])

  if (!message || typeof document === "undefined") return null

  return createPortal(
    <div
      key={message}
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-50 w-[min(calc(100%-2rem),22rem)] animate-in fade-in-0 slide-in-from-right-4"
    >
      <div className="relative overflow-hidden bg-popover text-popover-foreground shadow-lg">
        <svg
          className="pointer-events-none absolute inset-0 size-full text-foreground"
          aria-hidden
        >
          <rect
            x="1.5"
            y="1.5"
            width="calc(100% - 3px)"
            height="calc(100% - 3px)"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="2"
          />
          <rect
            x="1.5"
            y="1.5"
            width="calc(100% - 3px)"
            height="calc(100% - 3px)"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            pathLength={100}
            strokeDasharray={100}
            className="text-foreground"
            style={{
              animation: `undo-border-timer ${duration}ms linear forwards`,
            }}
          />
        </svg>
        <div className="relative flex items-center gap-2 px-3 py-2.5 text-sm">
          <p className="min-w-0 flex-1">{message}</p>
          <Button variant="outline" size="sm" onClick={onUndo}>
            <Undo2Icon />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
