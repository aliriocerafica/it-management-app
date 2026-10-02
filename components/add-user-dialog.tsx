"use client"

import { useState } from "react"
import { CheckIcon, PlusIcon } from "lucide-react"

import { FormField, selectClass } from "@/components/add-laptop-dialog"
import { PasswordRules } from "@/components/password-rules"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { isStrongPassword, passwordError } from "@/lib/password"
import type { UserDto, UserRole } from "@/lib/user-repository"

const initialForm = { name: "", email: "", password: "", role: "ADMIN" as UserRole }

export function AddUserDialog({ onAdd }: { onAdd: (user: UserDto) => void }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"form" | "confirm">("form")
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function reset() {
    setStep("form")
    setForm(initialForm)
    setError(null)
    setLoading(false)
  }

  function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    const strength = passwordError(form.password)
    if (!isStrongPassword(form.password) || strength) {
      setError(strength)
      return
    }
    setError(null)
    setStep("confirm")
  }

  async function handleConfirm() {
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Could not create user.")
        setLoading(false)
        return
      }

      const user = (await response.json()) as UserDto
      onAdd(user)
      setOpen(false)
      reset()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Add user
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Add user</DialogTitle>
              <DialogDescription>
                Create a local account for signing into this portal.
              </DialogDescription>
            </DialogHeader>

            <form
              id="add-user-form"
              onSubmit={handleReview}
              className="grid gap-4 px-6 py-5 sm:grid-cols-2"
            >
              <FormField label="Full name" htmlFor="name" className="sm:col-span-2">
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jordan Lee"
                  required
                />
              </FormField>
              <FormField label="Email" htmlFor="email" className="sm:col-span-2">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jordan@ardentparalegal.com"
                  required
                />
              </FormField>
              <FormField label="Password" htmlFor="password" className="sm:col-span-2">
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                <PasswordRules password={form.password} />
              </FormField>
              <FormField label="Role" htmlFor="role">
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className={selectClass}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff</option>
                </select>
              </FormField>
              {error && step === "form" && (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {error}
                </p>
              )}
            </form>

            <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" form="add-user-form">
                Review
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Confirm new user</DialogTitle>
              <DialogDescription>
                Double-check the details before creating this account.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 px-6 py-5 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{form.name}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{form.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium">
                  {form.role === "ADMIN" ? "Admin" : "Staff"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-muted-foreground">Password</span>
                <span className="font-mono font-medium">••••••••</span>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
              <Button variant="outline" onClick={() => setStep("form")} disabled={loading}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={loading}>
                <CheckIcon />
                {loading ? "Creating…" : "Confirm & create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
