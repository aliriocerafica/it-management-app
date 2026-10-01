"use client"

import { useEffect, useEffectEvent } from "react"
import { createPortal } from "react-dom"
import { TriangleAlertIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

// Shown when a background save fails and the table has rolled the change back.
export function ErrorToast({
  message,
  onDismiss,
  duration = 10000,
}: {
  message: string | null
  onDismiss: () => void
  duration?: number
}) {
  const dismiss = useEffectEvent(onDismiss)

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => dismiss(), duration)
    return () => window.clearTimeout(timeout)
  }, [message, duration])

  if (!message || typeof document === "undefined") return null

  return createPortal(
    <div
      key={message}
      role="alert"
      className="fixed top-4 right-4 z-50 w-[min(calc(100%-2rem),22rem)] animate-in fade-in-0 slide-in-from-right-4"
    >
      <div className="flex items-start gap-2 border-2 border-destructive/40 bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1">{message}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          className="-my-1"
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>
    </div>,
    document.body,
  )
}
