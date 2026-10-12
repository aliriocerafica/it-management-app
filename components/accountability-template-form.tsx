"use client"

import * as React from "react"
import { CheckIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AccountabilityFormSettings } from "@/lib/accountability-form-settings"
import { cn } from "@/lib/utils"

type Officer = {
  // Stable in this editor; saved officers also have an id.
  key: string
  id?: string
  name: string
  email: string | null
  signature: string | null
}

// Signatures are stored inline, so uploads are redrawn small.
const SIGNATURE_MAX_WIDTH = 600
const SIGNATURE_MAX_HEIGHT = 240

let nextKey = 0
const newKey = () => `new-${nextKey++}`

// Shrinks an uploaded image to a PNG data URL, keeping any transparency.
async function signatureDataUrl(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(
    1,
    SIGNATURE_MAX_WIDTH / bitmap.width,
    SIGNATURE_MAX_HEIGHT / bitmap.height,
  )
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No canvas")
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/png")
}

// One signatory: the signature (click to upload or replace it), the printed
// name, and a line of status underneath. `meta` and `action` are the parts
// that differ between IT officers and HR.
function SignatoryRow({
  name,
  onNameChange,
  placeholder,
  email,
  onEmailChange,
  signature,
  onUpload,
  onRemoveSignature,
  meta,
  action,
  disabled,
}: {
  name: string
  onNameChange: (name: string) => void
  placeholder: string
  email: string | null
  onEmailChange: (email: string | null) => void
  signature: string | null
  onUpload: (file: File | undefined) => void
  onRemoveSignature: () => void
  meta?: React.ReactNode
  action?: React.ReactNode
  disabled?: boolean
}) {
  const owner = name.trim() || "this signatory"
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <label
        title={signature ? "Replace signature" : "Upload signature"}
        className={cn(
          "group relative flex h-11 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border text-[11px] text-muted-foreground transition-colors focus-within:ring-2 focus-within:ring-ring",
          // White, as on paper, so a dark-ink signature shows in dark mode.
          signature
            ? "border-border bg-white"
            : "gap-1 border-dashed border-border hover:bg-muted hover:text-foreground",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {signature ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signature}
              alt={`Signature of ${owner}`}
              className="max-h-full max-w-full object-contain p-0.5"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/65 font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              Replace
            </span>
          </>
        ) : (
          <>
            <UploadIcon className="size-3.5" />
            Signature
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg"
          aria-label={`Upload a signature for ${owner}`}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            onUpload(event.target.files?.[0])
            event.target.value = ""
          }}
        />
      </label>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          required
          disabled={disabled}
          className="h-7 border-transparent bg-transparent px-1.5 font-medium shadow-none hover:border-border dark:bg-transparent"
        />
        <Input
          type="email"
          value={email ?? ""}
          onChange={(event) => onEmailChange(event.target.value.trim() || null)}
          placeholder="Email, to be copied on sent forms"
          aria-label={`Email address of ${owner}`}
          disabled={disabled}
          className="h-6 border-transparent bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:border-border md:text-xs dark:bg-transparent"
        />
        <div className="flex min-h-4 items-center gap-2 px-1.5 text-[11px] text-muted-foreground">
          {meta}
          {signature ? (
            <button
              type="button"
              onClick={onRemoveSignature}
              className="rounded outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remove signature
            </button>
          ) : (
            !meta && <span>No signature yet</span>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

export function AccountabilityTemplateForm() {
  const [hrName, setHrName] = React.useState("")
  const [hrEmail, setHrEmail] = React.useState<string | null>(null)
  const [hrSignature, setHrSignature] = React.useState<string | null>(null)
  const [officers, setOfficers] = React.useState<Officer[]>([])
  // The officer picked by default on new forms.
  const [defaultKey, setDefaultKey] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  function load(settings: AccountabilityFormSettings) {
    const next = settings.itOfficers.map((officer) => ({
      ...officer,
      key: officer.id,
    }))
    setHrName(settings.hrName)
    setHrEmail(settings.hrEmail)
    setHrSignature(settings.hrSignature)
    setOfficers(next)
    setDefaultKey(
      (
        next.find(
          (officer) =>
            officer.name.toLowerCase() === settings.itOfficerName.toLowerCase(),
        ) ?? next[0]
      )?.key ?? null,
    )
  }

  React.useEffect(() => {
    let cancelled = false
    void fetch("/api/accountability-form-settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load")
        return response.json() as Promise<AccountabilityFormSettings>
      })
      .then((settings) => {
        if (cancelled) return
        load(settings)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load the accountability template.")
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateOfficer(key: string, change: Partial<Officer>) {
    setSuccess(false)
    setOfficers((prev) =>
      prev.map((officer) =>
        officer.key === key ? { ...officer, ...change } : officer,
      ),
    )
  }

  function addOfficer() {
    const key = newKey()
    setSuccess(false)
    setOfficers((prev) => [
      ...prev,
      { key, name: "", email: null, signature: null },
    ])
    if (!defaultKey) setDefaultKey(key)
  }

  function removeOfficer(key: string) {
    const rest = officers.filter((officer) => officer.key !== key)
    setSuccess(false)
    setOfficers(rest)
    if (defaultKey === key) setDefaultKey(rest[0]?.key ?? null)
  }

  async function readSignature(
    file: File | undefined,
    apply: (signature: string) => void,
  ) {
    if (!file) return
    setError(null)
    try {
      apply(await signatureDataUrl(file))
    } catch {
      setError("That file couldn't be read as an image. Use a PNG or JPG.")
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    const chosen = officers.find((officer) => officer.key === defaultKey)
    if (!chosen) {
      setError("Add at least one IT officer.")
      return
    }
    setLoading(true)

    try {
      const response = await fetch("/api/accountability-form-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hrName: hrName.trim(),
          hrEmail,
          hrSignature,
          itOfficerName: chosen.name.trim(),
          itOfficers: officers.map((officer) => ({
            id: officer.id,
            name: officer.name.trim(),
            email: officer.email,
            signature: officer.signature,
          })),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Something went wrong.")
        return
      }

      load((await response.json()) as AccountabilityFormSettings)
      setSuccess(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        A signature on file is printed above the name. Without one, the line is
        left blank to sign by hand. Signatories with an email are copied when
        their forms are sent.
      </p>

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">IT Officers</h3>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!ready}
            onClick={addOfficer}
          >
            <PlusIcon />
            Add officer
          </Button>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border">
          {officers.map((officer) => {
            const isDefault = officer.key === defaultKey
            return (
              <SignatoryRow
                key={officer.key}
                name={officer.name}
                onNameChange={(name) => updateOfficer(officer.key, { name })}
                placeholder="IT Officer printed name"
                email={officer.email}
                onEmailChange={(email) => updateOfficer(officer.key, { email })}
                signature={officer.signature}
                onUpload={(file) =>
                  void readSignature(file, (signature) =>
                    updateOfficer(officer.key, { signature }),
                  )
                }
                onRemoveSignature={() =>
                  updateOfficer(officer.key, { signature: null })
                }
                meta={
                  isDefault ? (
                    <span className="inline-flex items-center gap-1 font-medium text-blue-500">
                      <CheckIcon className="size-3" />
                      Default signatory
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultKey(officer.key)
                        setSuccess(false)
                      }}
                      className="rounded outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Set as default
                    </button>
                  )
                }
                action={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${officer.name || "this officer"}`}
                    disabled={officers.length === 1}
                    onClick={() => removeOfficer(officer.key)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon />
                  </Button>
                }
              />
            )
          })}
          {officers.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {ready ? "No IT officers yet." : "Loading…"}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Human Resource</h3>
        <div className="rounded-xl border border-border">
          <SignatoryRow
            name={hrName}
            onNameChange={(name) => {
              setHrName(name)
              setSuccess(false)
            }}
            placeholder="HR printed name"
            email={hrEmail}
            onEmailChange={(email) => {
              setHrEmail(email)
              setSuccess(false)
            }}
            signature={hrSignature}
            disabled={!ready}
            onUpload={(file) =>
              void readSignature(file, (signature) => {
                setHrSignature(signature)
                setSuccess(false)
              })
            }
            onRemoveSignature={() => {
              setHrSignature(null)
              setSuccess(false)
            }}
          />
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !ready}>
          {loading ? "Saving…" : "Save template"}
        </Button>
        {success && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="size-3.5" />
            Saved
          </span>
        )}
      </div>
    </form>
  )
}
