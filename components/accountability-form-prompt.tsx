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
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
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
        setHrName("CAMILLE TUIBEO")
        setItOfficerName("")
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
