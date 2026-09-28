"use client"

import * as React from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { PasswordRules } from "@/components/password-rules"
import { isStrongPassword } from "@/lib/password"

export function ChangePasswordForm() {
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const data = new FormData(event.currentTarget)
    const currentPassword = String(data.get("currentPassword") ?? "")
    const nextPassword = String(data.get("newPassword") ?? "")
    const confirmPasswordValue = String(data.get("confirmPassword") ?? "")

    if (!isStrongPassword(nextPassword)) {
      setError("Password does not meet the required checks.")
      setLoading(false)
      return
    }

    if (nextPassword !== confirmPasswordValue) {
      setError("New passwords do not match.")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: nextPassword }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Something went wrong.")
        setLoading(false)
        return
      }

      setSuccess(true)
      setNewPassword("")
      setConfirmPassword("")
      formRef.current?.reset()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
          <PasswordInput
            id="currentPassword"
            name="currentPassword"
            autoComplete="current-password"
            show={showCurrent}
            onToggle={() => setShowCurrent((prev) => !prev)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="newPassword">New password</FieldLabel>
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            show={showNew}
            onToggle={() => setShowNew((prev) => !prev)}
            required
          />
        </Field>
        <PasswordRules password={newPassword} />
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            show={showConfirm}
            onToggle={() => setShowConfirm((prev) => !prev)}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Password updated. Your other sessions have been signed out.
          </p>
        )}
      </FieldGroup>
      <Button type="submit" disabled={loading} className="w-fit">
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  )
}

function PasswordInput({
  show,
  onToggle,
  ...props
}: React.ComponentProps<typeof Input> & {
  show: boolean
  onToggle: () => void
}) {
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-9" />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
      </button>
    </div>
  )
}
