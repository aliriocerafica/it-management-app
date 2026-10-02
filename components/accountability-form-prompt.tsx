"use client"

import { useEffect, useState } from "react"
import { FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AccountabilityFormPrompt({
  open,
  onOpenChange,
  employeeName,
  onGenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string | undefined
  onGenerate: (names: { hrName: string; itOfficerName: string }) => void
}) {
  const [hrName, setHrName] = useState("")
  const [itOfficerName, setItOfficerName] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(open)
  // Show the spinner as soon as the dialog opens, before the effect runs.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setLoading(true)
      setLoadError(null)
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.all([
      fetch("/api/accountability-form-settings").then(async (response) => {
        if (!response.ok) throw new Error("Failed to load")
        return response.json() as Promise<{ hrName: string; itOfficerName: string }>
      }),
      fetch("/api/auth/me").then(async (response) => {
        if (!response.ok) return null
        const body = (await response.json()) as { user?: { name: string } }
        return body.user?.name ?? null
      }),
    ])
      .then(([settings, currentName]) => {
        if (cancelled) return
        setHrName(settings.hrName)
        setItOfficerName(settings.itOfficerName || currentName || "")
      })
      .catch(() => {
        if (cancelled) return
        setHrName("")
        setItOfficerName("")
        setLoadError("Couldn't load the saved names. Close this and try again.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assigned to {employeeName}</DialogTitle>
          <DialogDescription>
            Generate the accountability form covering everything currently assigned to
            them?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="it-officer-name">IT Officer</Label>
            <Input
              id="it-officer-name"
              value={itOfficerName}
              onChange={(e) => setItOfficerName(e.target.value)}
              placeholder="IT Officer printed name"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hr-name">Human Resource</Label>
            <Input
              id="hr-name"
              value={hrName}
              onChange={(e) => setHrName(e.target.value)}
              placeholder="HR printed name"
              disabled={loading}
            />
          </div>
          {loadError && (
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Not now</DialogClose>
          <Button
            disabled={loading || !hrName.trim() || !itOfficerName.trim()}
            onClick={() => {
              onGenerate({
                hrName: hrName.trim(),
                itOfficerName: itOfficerName.trim(),
              })
              onOpenChange(false)
            }}
          >
            <FileTextIcon />
            Generate form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
