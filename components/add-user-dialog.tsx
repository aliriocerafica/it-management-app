"use client"

import { useMemo, useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  KeyRoundIcon,
  MailIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"

import { FormField, selectClass } from "@/components/add-laptop-dialog"
import { EmployeePickerDialog } from "@/components/employee-picker-dialog"
import { FormSelect } from "@/components/form-select"
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
import { cn } from "@/lib/utils"

const initialForm = {
  name: "",
  email: "",
  passwordMode: "link" as "link" | "now",
  password: "",
  role: "ADMIN" as UserRole,
}

export function AddUserDialog({
  users,
  onAdd,
}: {
  users: UserDto[]
  // `emailError` is set when the user was created but the setup link email failed.
  onAdd: (user: UserDto, emailError: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"form" | "confirm">("form")
  const [form, setForm] = useState(initialForm)
  const [employeeName, setEmployeeName] = useState("")
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Flags employees who already have a portal account in the picker.
  const accountHolders = useMemo(
    () => users.map((user) => ({ handler: user.name, assetTag: "an account" })),
    [users],
  )

  function reset() {
    setStep("form")
    setForm(initialForm)
    setEmployeeName("")
    setError(null)
    setLoading(false)
  }

  function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    if (form.passwordMode === "now") {
      const strength = passwordError(form.password)
      if (!isStrongPassword(form.password) || strength) {
        setError(strength)
        return
      }
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
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.passwordMode === "now" ? { password: form.password } : {}),
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Could not create user.")
        setLoading(false)
        return
      }

      const { emailError = null, ...user } = (await response.json()) as UserDto & {
        emailError?: string | null
      }
      onAdd(user, emailError)
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
              <FormField label="Employee" htmlFor="employee" optional className="sm:col-span-2">
                <div className="relative">
                  <button
                    id="employee"
                    type="button"
                    aria-haspopup="dialog"
                    className={cn(
                      selectClass,
                      "flex items-center justify-between gap-2 text-left",
                      employeeName && "pr-8",
                    )}
                    onClick={() => setPicking(true)}
                  >
                    <span className={cn("truncate", !employeeName && "text-muted-foreground")}>
                      {employeeName || "Select from employee directory"}
                    </span>
                    {!employeeName && (
                      <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {employeeName && (
                    <button
                      type="button"
                      aria-label="Clear employee"
                      className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() => {
                        setEmployeeName("")
                        setForm((f) => ({ ...f, name: "", email: "" }))
                      }}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              </FormField>
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
              <FormField label="Password" htmlFor="password-mode-link" className="sm:col-span-2">
                <div
                  role="radiogroup"
                  aria-label="Password"
                  className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                >
                  {(
                    [
                      { value: "link", label: "Email a setup link", icon: MailIcon },
                      { value: "now", label: "Set password now", icon: KeyRoundIcon },
                    ] as const
                  ).map((option) => {
                    const checked = form.passwordMode === option.value
                    return (
                      <button
                        key={option.value}
                        id={`password-mode-${option.value}`}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => setForm((f) => ({ ...f, passwordMode: option.value }))}
                        className={cn(
                          "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-3.5",
                          checked
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <option.icon />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {form.passwordMode === "link" ? (
                  <p className="text-xs text-muted-foreground">
                    They&apos;ll get an email with a link to choose their own password,
                    then can sign in. The link expires in 3 days.
                  </p>
                ) : (
                  <>
                    <Input
                      id="password"
                      type="password"
                      aria-label="Password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                      required
                    />
                    <PasswordRules password={form.password} />
                  </>
                )}
              </FormField>
              <FormField label="Role" htmlFor="role">
                <FormSelect
                  id="role"
                  value={form.role}
                  onChange={(value) => setForm((f) => ({ ...f, role: value as UserRole }))}
                  options={[
                    { value: "ADMIN", label: "Admin" },
                    { value: "STAFF", label: "Staff" },
                  ]}
                />
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

            <EmployeePickerDialog
              open={picking}
              onOpenChange={setPicking}
              holders={accountHolders}
              noun="account"
              title="Select employee"
              description="Fill in the new user's name and email from the employee directory."
              selectedLabel="Selected"
              onPick={(employee) => {
                setEmployeeName(employee.name)
                setForm((f) => ({
                  ...f,
                  name: employee.name,
                  email: employee.email || f.email,
                }))
                setPicking(false)
              }}
            />
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
                {form.passwordMode === "link" ? (
                  <span className="font-medium">Setup link emailed</span>
                ) : (
                  <span className="font-mono font-medium">••••••••</span>
                )}
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
                {loading
                  ? "Creating…"
                  : form.passwordMode === "link"
                    ? "Create & send link"
                    : "Confirm & create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
