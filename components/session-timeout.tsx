"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { IDLE_TIMEOUT_MINUTES } from "@/lib/auth/constants"

const IDLE_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000
const HEARTBEAT_MS = 60 * 1000
const CHECK_MS = 15 * 1000
const ACTIVITY_KEY = "it-session-last-activity"
const LOGOUT_REASON_KEY = "it-logout-reason"

let memoryActivity = 0

function readActivity() {
  try {
    const parsed = Number(localStorage.getItem(ACTIVITY_KEY))
    if (Number.isFinite(parsed)) return Math.max(parsed, memoryActivity)
  } catch {
    // Private mode can block storage; the in-memory stamp still works.
  }
  return memoryActivity
}

function writeActivity(now: number) {
  memoryActivity = now
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now))
  } catch {
    // Ignore storage failures and keep the in-memory stamp.
  }
}

function rememberInactivityLogout() {
  try {
    sessionStorage.setItem(LOGOUT_REASON_KEY, "inactivity")
  } catch {
    // The open modal still explains the logout in this tab.
  }
}

function clearInactivityLogout() {
  try {
    sessionStorage.removeItem(LOGOUT_REASON_KEY)
  } catch {
    // Nothing to clear.
  }
}

function InactivityLogoutDialog({
  open,
  pending = false,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  pending?: boolean
  confirmLabel: string
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        if (!next) details.cancel()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Automatically logged out</DialogTitle>
          <DialogDescription>
            You were automatically logged out due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Signing out…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Watches real use of the dashboard (including other tabs) and, once the idle
// limit passes, ends the session and explains why.
export function SessionIdleWatch() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const loggedOut = useRef(false)

  useEffect(() => {
    let cancelled = false

    function showLoggedOut() {
      if (cancelled) return
      setOpen(true)
      setPending(true)
      void fetch("/api/auth/logout", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setPending(false)
        })
    }

    try {
      if (sessionStorage.getItem(LOGOUT_REASON_KEY) === "inactivity") {
        loggedOut.current = true
        showLoggedOut()
        return () => {
          cancelled = true
        }
      }
    } catch {
      // Continue with a fresh idle clock.
    }

    writeActivity(Date.now())
    let lastWrite = Date.now()
    let lastBeat = Date.now()

    function expire(force = false) {
      if (loggedOut.current || cancelled) return
      if (!force && Date.now() - readActivity() < IDLE_MS) return
      loggedOut.current = true
      rememberInactivityLogout()
      showLoggedOut()
    }

    function onActivity() {
      if (loggedOut.current) return
      const now = Date.now()
      if (now - readActivity() >= IDLE_MS) {
        expire()
        return
      }
      if (now - lastWrite < 1000) return
      lastWrite = now
      writeActivity(now)
      if (now - lastBeat < HEARTBEAT_MS) return
      lastBeat = now
      void fetch("/api/auth/me", { cache: "no-store" })
        .then(async (response) => {
          if (loggedOut.current || response.status !== 401) return
          const body = (await response.json().catch(() => null)) as {
            reason?: string
          } | null
          if (body?.reason === "idle") expire(true)
        })
        .catch(() => {})
    }

    function checkIdle() {
      if (Date.now() - readActivity() >= IDLE_MS) expire()
    }

    const events = ["pointerdown", "pointermove", "keydown", "wheel"] as const
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true })
    }
    window.addEventListener("scroll", onActivity, { passive: true, capture: true })
    document.addEventListener("visibilitychange", checkIdle)
    const timer = window.setInterval(checkIdle, CHECK_MS)

    return () => {
      cancelled = true
      for (const event of events) window.removeEventListener(event, onActivity)
      window.removeEventListener("scroll", onActivity, { capture: true })
      document.removeEventListener("visibilitychange", checkIdle)
      window.clearInterval(timer)
    }
  }, [])

  async function signIn() {
    if (pending) return
    setPending(true)
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })
      if (!response.ok) throw new Error("logout failed")
    } catch {
      setPending(false)
      return
    }
    clearInactivityLogout()
    window.location.assign("/login")
  }

  return (
    <InactivityLogoutDialog
      open={open}
      pending={pending}
      confirmLabel="Sign in"
      onConfirm={signIn}
    />
  )
}

// Shown on the login page when the server already ended an idle session.
export function InactivityLogoutNotice({ show }: { show: boolean }) {
  const [open, setOpen] = useState(show)

  useEffect(() => {
    if (show) return
    try {
      if (sessionStorage.getItem(LOGOUT_REASON_KEY) === "inactivity") {
        setOpen(true)
      }
    } catch {
      // No stored reason to show.
    }
  }, [show])

  function dismiss() {
    clearInactivityLogout()
    setOpen(false)
    const url = new URL(window.location.href)
    if (!url.searchParams.has("reason")) return
    url.searchParams.delete("reason")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(null, "", next)
  }

  return (
    <InactivityLogoutDialog open={open} confirmLabel="OK" onConfirm={dismiss} />
  )
}
