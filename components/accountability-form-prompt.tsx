"use client"

import { useEffect, useState } from "react"
import { FileTextIcon } from "lucide-react"

import { FormSelect } from "@/components/form-select"
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
import type { AccountabilityFormSettings } from "@/lib/accountability-form-settings"

const checkIcon =
  "https://media.lordicon.com/icons/system/outline/24-check-circle.gif"
const documentIcon =
  "https://media.lordicon.com/icons/system/outline/56-document.gif"
// How long the success check plays before the document takes its place.
const CHECK_MS = 1800

// An animated Lordicon. They're drawn on white, so it sits on a white disc
// that also reads as a badge in dark mode.
function LordIcon({ src }: { src: string }) {
  return (
    <span
      key={src}
      className="mx-auto flex size-20 animate-in items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-foreground/10 duration-300 fade-in zoom-in-50"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={64} height={64} className="size-16" />
    </span>
  )
}

export function AccountabilityFormPrompt({
  open,
  onOpenChange,
  employeeName,
  released = false,
  onGenerate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string | undefined
  // The asset was just released to them: open on a success check before
  // offering the form.
  released?: boolean
  onGenerate: (names: { hrName: string; itOfficerName: string }) => void
}) {
  const [hrName, setHrName] = useState("")
  const [itOfficerName, setItOfficerName] = useState("")
  // The IT officers set up in Settings, to pick the signatory from.
  const [itOfficers, setItOfficers] = useState<
    AccountabilityFormSettings["itOfficers"]
  >([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(open)
  const [celebrating, setCelebrating] = useState(open && released)
  // Show the spinner as soon as the dialog opens, before the effect runs.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setLoading(true)
      setLoadError(null)
      setCelebrating(released)
    }
  }

  useEffect(() => {
    if (!open || !released) return
    const timer = window.setTimeout(() => setCelebrating(false), CHECK_MS)
    return () => window.clearTimeout(timer)
  }, [open, released])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.all([
      fetch("/api/accountability-form-settings").then(async (response) => {
        if (!response.ok) throw new Error("Failed to load")
        return response.json() as Promise<AccountabilityFormSettings>
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
        setItOfficers(settings.itOfficers)
        setItOfficerName(
          settings.itOfficerName ||
            settings.itOfficers[0]?.name ||
            currentName ||
            "",
        )
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
        <LordIcon src={celebrating ? checkIcon : documentIcon} />
        <DialogHeader className="text-center">
          <DialogTitle>
            {released ? "Released" : "Assigned"} to {employeeName}
          </DialogTitle>
          <DialogDescription>
            Generate the accountability form covering everything currently assigned to
            them?
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="it-officer-name">IT Officer</Label>
            {itOfficers.length > 0 ? (
              <>
                <FormSelect
                  id="it-officer-name"
                  value={itOfficerName}
                  onChange={setItOfficerName}
                  options={itOfficers.map((officer) => ({
                    value: officer.name,
                    label: officer.name,
                  }))}
                  placeholder="Choose the IT Officer"
                />
                <p className="text-xs text-muted-foreground">
                  {itOfficers.find((officer) => officer.name === itOfficerName)
                    ?.signature
                    ? "Their signature on file will be printed on the form."
                    : "No signature on file, so the form is left for a handwritten one."}
                </p>
              </>
            ) : (
              <Input
                id="it-officer-name"
                value={itOfficerName}
                onChange={(e) => setItOfficerName(e.target.value)}
                placeholder="IT Officer printed name"
                disabled={loading}
              />
            )}
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
