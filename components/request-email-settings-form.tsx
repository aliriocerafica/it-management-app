"use client"

import * as React from "react"
import {
  CheckIcon,
  MailIcon,
  PenLineIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { initials } from "@/lib/laptops"
import type { RequestEmailSettings } from "@/lib/request-email-settings"
import { useEmployeeDirectory } from "@/lib/use-employee-directory"
import { cn } from "@/lib/utils"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A portal user as edited here: `address` is what's in their email box.
type PortalUser = {
  id: string
  name: string
  loginEmail: string
  address: string
  copied: boolean
}

const rowClass =
  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

const paneClass =
  "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"

function KindLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  )
}

// The tick at the end of a row, as in the assign dialog's employee list.
function Tick({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-input",
      )}
    >
      {checked && <CheckIcon className="size-3" />}
    </span>
  )
}

function RecipientRow({
  checked,
  onToggle,
  avatar,
  title,
  subtitle,
  badge,
  dashed,
}: {
  checked: boolean
  onToggle: () => void
  avatar: React.ReactNode
  title: string
  subtitle: string
  badge?: string
  dashed?: boolean
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        rowClass,
        checked
          ? "border-foreground/30 bg-muted"
          : dashed
            ? "border-dashed border-border hover:bg-muted/60"
            : "border-transparent hover:bg-muted/60",
      )}
    >
      {avatar}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{title}</span>
          {badge && <KindLabel>{badge}</KindLabel>}
        </div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <Tick checked={checked} />
    </button>
  )
}

function IconAvatar({ icon: Icon }: { icon: typeof MailIcon }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
      <Icon className="size-4 text-muted-foreground" />
    </span>
  )
}

function NameAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-9 after:rounded-full">
      <AvatarFallback className="bg-muted text-xs font-medium">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function PaneHeader({
  title,
  description,
  aside,
}: {
  title: string
  description?: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {aside}
    </div>
  )
}

function SelectedPersonCard({
  name,
  badge,
  subtitle,
  onRemove,
}: {
  name: string
  badge: string
  subtitle: string
  onRemove: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start gap-3">
        <NameAvatar name={name} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">{name}</span>
            <KindLabel>{badge}</KindLabel>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  )
}

function AddRecipientsDialog({
  open,
  onOpenChange,
  alreadySelected,
  onToggle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  alreadySelected: string[]
  // Ticking here copies them; they show below the portal users.
  onToggle: (email: string) => void
}) {
  const directory = useEmployeeDirectory()
  const [query, setQuery] = React.useState("")

  const q = query.trim().toLowerCase()
  const directoryEmails = new Set(
    directory.employees.map((employee) => employee.email.trim().toLowerCase()),
  )
  const employees = directory.employees
    .map((employee) => ({
      ...employee,
      email: employee.email.trim().toLowerCase(),
    }))
    .filter(
      (employee) =>
        employee.email &&
        (!q ||
          [
            employee.name,
            employee.id,
            employee.department,
            employee.title,
            employee.email,
          ].some((value) => value.toLowerCase().includes(q))),
    )
    .sort(
      (a, b) =>
        Number(alreadySelected.includes(b.email)) -
          Number(alreadySelected.includes(a.email)) ||
        a.name.localeCompare(b.name),
    )
  const typedSelected = alreadySelected.filter(
    (email) =>
      !directoryEmails.has(email) && (!q || email.includes(q)),
  )
  const canAddTyped =
    emailPattern.test(q) && !alreadySelected.includes(q) && !directoryEmails.has(q)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Start from an empty search the next time it opens.
        if (!next) setQuery("")
        onOpenChange(next)
      }}
    >
      <DialogContent
        nested
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-lg font-semibold">
            Other recipients
            {alreadySelected.length > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {alreadySelected.length} selected
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Tick someone to copy them. They appear below the portal users.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-3 px-6 pt-4 pb-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                if (canAddTyped) onToggle(q)
              }}
              placeholder={
                directory.employees.length
                  ? "Search, or type an email address"
                  : "Type an email address"
              }
              className="pl-8"
              autoFocus
            />
          </div>
          <div
            role="group"
            aria-label="Other recipients"
            aria-busy={directory.status === "loading"}
            className="flex max-h-80 min-h-48 flex-col gap-1 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            {canAddTyped && (
              <RecipientRow
                dashed
                checked={false}
                onToggle={() => onToggle(q)}
                avatar={<IconAvatar icon={PenLineIcon} />}
                title={`Copy “${q}”`}
                subtitle="Typed manually, not in the employee directory"
              />
            )}
            {typedSelected.map((email) => (
              <RecipientRow
                key={email}
                checked
                onToggle={() => onToggle(email)}
                avatar={<IconAvatar icon={MailIcon} />}
                title={email}
                subtitle="Typed manually, not in the employee directory"
              />
            ))}
            {employees.map((employee) => (
              <RecipientRow
                key={employee.id}
                checked={alreadySelected.includes(employee.email)}
                onToggle={() => onToggle(employee.email)}
                avatar={<NameAvatar name={employee.name} />}
                title={employee.name}
                subtitle={[employee.email, employee.title, employee.department]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
            {employees.length === 0 &&
              typedSelected.length === 0 &&
              !canAddTyped && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {directory.status === "loading"
                    ? "Loading employees from HRIS…"
                    : directory.status === "error"
                      ? "Couldn't reach the HRIS employee directory. Type the person's email address above."
                      : q
                        ? "No employees match your search. Type a full email address to add someone else."
                        : "No employees found in HRIS. Type the person's email address above."}
                </p>
              )}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RequestEmailSettingsForm({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [dirty, setDirtyState] = React.useState(false)
  function setDirty(next: boolean) {
    setDirtyState(next)
    onDirtyChange?.(next)
  }
  const [portalUsers, setPortalUsers] = React.useState<PortalUser[]>([])
  const [recipients, setRecipients] = React.useState<string[]>([])
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const directory = useEmployeeDirectory()

  function load(settings: RequestEmailSettings) {
    setPortalUsers(
      settings.appUsers.map((user) => ({
        id: user.id,
        name: user.name,
        loginEmail: user.loginEmail,
        address: user.email ?? user.loginEmail,
        copied: user.copied,
      })),
    )
    setRecipients(settings.extraRecipients)
  }

  React.useEffect(() => {
    let cancelled = false
    void fetch("/api/request-email-settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load")
        return response.json() as Promise<RequestEmailSettings>
      })
      .then((settings) => {
        if (cancelled) return
        load(settings)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load the request email settings.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  function edited() {
    setSuccess(false)
    setError(null)
    setDirty(true)
  }

  function updatePortalUser(id: string, patch: Partial<PortalUser>) {
    setPortalUsers((prev) =>
      prev.map((user) => (user.id === id ? { ...user, ...patch } : user)),
    )
    edited()
  }

  function toggleRecipient(email: string) {
    setRecipients((prev) =>
      prev.includes(email)
        ? prev.filter((other) => other !== email)
        : [...prev, email],
    )
    edited()
  }

  const directoryEmails = new Set(
    directory.employees.map((employee) => employee.email.trim().toLowerCase()),
  )
  const selectedEmployees = recipients
    .filter((email) => directoryEmails.has(email))
    .map((email) => {
      const employee = directory.employees.find(
        (person) => person.email.trim().toLowerCase() === email,
      )
      return {
        email,
        name: employee?.name ?? email,
        subtitle: [employee?.email, employee?.title, employee?.department]
          .filter(Boolean)
          .join(" · "),
      }
    })
  // Addresses typed in by hand, for people outside the directory.
  const typedRecipients = recipients.filter(
    (email) => !directoryEmails.has(email),
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccess(false)

    const invalid = portalUsers.find(
      (user) =>
        user.copied &&
        user.address.trim() &&
        !emailPattern.test(user.address.trim()),
    )
    if (invalid) {
      setError(`Enter a valid email address for ${invalid.name}.`)
      return
    }
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/request-email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appUsers: portalUsers.map((user) => {
            const address = user.address.trim().toLowerCase()
            return {
              id: user.id,
              copied: user.copied,
              // Left empty, or unusable on someone who isn't copied anyway:
              // back to their sign-in address.
              email:
                address &&
                address !== user.loginEmail &&
                emailPattern.test(address)
                  ? address
                  : null,
            }
          }),
          extraRecipients: recipients,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Something went wrong.")
        return
      }

      load((await response.json()) as RequestEmailSettings)
      setDirty(false)
      setSuccess(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const nobodyCopied =
    ready &&
    recipients.length === 0 &&
    portalUsers.every((user) => !user.copied)

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          Asset request emails
        </DialogTitle>
        <DialogDescription>
          Who is copied on the emails sent to an employee about their request.
          The employee always receives it: when a request is logged, approved,
          denied, issued or completed.
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto bg-muted/30 p-4 md:grid-cols-2 md:overflow-hidden">
        <section className={paneClass}>
          <PaneHeader
            title="Portal users"
            description="Changing an address here only changes where these emails go, not how they sign in."
          />
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {portalUsers.map((user) => (
              <div
                key={user.id}
                className={cn(
                  rowClass,
                  user.copied
                    ? "border-foreground/30 bg-muted"
                    : "border-border",
                )}
              >
                <NameAvatar name={user.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm leading-tight font-medium">
                      {user.name}
                    </span>
                    <KindLabel>Portal</KindLabel>
                  </div>
                  <Input
                    type="email"
                    value={user.address}
                    onChange={(event) =>
                      updatePortalUser(user.id, {
                        address: event.target.value,
                      })
                    }
                    placeholder={user.loginEmail}
                    aria-label={`Email ${user.name} is copied at`}
                    disabled={!user.copied}
                    className="h-7 text-xs"
                  />
                </div>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={user.copied}
                  aria-label={`Copy ${user.name}`}
                  onClick={() =>
                    updatePortalUser(user.id, { copied: !user.copied })
                  }
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Tick checked={user.copied} />
                </button>
              </div>
            ))}
            {portalUsers.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {ready ? "No active portal users." : "Loading…"}
              </p>
            )}
          </div>
        </section>

        <section className={paneClass}>
          <PaneHeader
            title="Other recipients"
            description="Copied below the portal users."
            aside={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={!ready}
              >
                <PlusIcon />
                Add
              </Button>
            }
          />
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {selectedEmployees.map((employee) => (
              <SelectedPersonCard
                key={employee.email}
                name={employee.name}
                badge="Employee"
                subtitle={employee.subtitle || employee.email}
                onRemove={() => toggleRecipient(employee.email)}
              />
            ))}
            {typedRecipients.map((email) => (
              <SelectedPersonCard
                key={email}
                name={email}
                badge="Manual"
                subtitle="Not in the employee directory"
                onRemove={() => toggleRecipient(email)}
              />
            ))}
            {recipients.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Nobody else is copied yet. Add someone and they appear here.
              </p>
            )}
          </div>
        </section>
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-6 py-4 sm:justify-between">
        <div className="mr-auto flex min-w-0 flex-col gap-1 sm:mr-0">
          {nobodyCopied && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Nobody will be copied: only the employee gets these emails.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {dirty && !loading && !error && !nobodyCopied && (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
          {success && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="size-3.5" />
              Saved
            </span>
          )}
        </div>
        <Button type="submit" disabled={loading || !ready}>
          {loading ? "Saving…" : "Save recipients"}
        </Button>
      </DialogFooter>

      <AddRecipientsDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        alreadySelected={recipients}
        onToggle={toggleRecipient}
      />
    </form>
  )
}
