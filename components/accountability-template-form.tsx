"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function AccountabilityTemplateForm() {
  const [hrName, setHrName] = React.useState("")
  const [itOfficerName, setItOfficerName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void fetch("/api/accountability-form-settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load")
        return response.json() as Promise<{ hrName: string; itOfficerName: string }>
      })
      .then((settings) => {
        if (cancelled) return
        setHrName(settings.hrName)
        setItOfficerName(settings.itOfficerName)
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const response = await fetch("/api/accountability-form-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hrName: hrName.trim(),
          itOfficerName: itOfficerName.trim(),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Something went wrong.")
        return
      }

      const saved = (await response.json()) as { hrName: string; itOfficerName: string }
      setHrName(saved.hrName)
      setItOfficerName(saved.itOfficerName)
      setSuccess(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <div className="grid gap-4">
        <Field>
          <FieldLabel htmlFor="itOfficerName">IT Officer</FieldLabel>
          <Input
            id="itOfficerName"
            name="itOfficerName"
            value={itOfficerName}
            onChange={(event) => setItOfficerName(event.target.value)}
            placeholder="IT Officer printed name"
            required
            disabled={!ready}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="hrName">Human Resource</FieldLabel>
          <Input
            id="hrName"
            name="hrName"
            value={hrName}
            onChange={(event) => setHrName(event.target.value)}
            placeholder="HR printed name"
            required
            disabled={!ready}
          />
        </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Accountability template updated.
          </p>
        )}
      </FieldGroup>
      <Button type="submit" disabled={loading || !ready} className="w-fit">
        {loading ? "Saving…" : "Save template"}
      </Button>
    </form>
  )
}
